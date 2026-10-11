import type { Request, Response } from 'express';
import { z } from 'zod';
import { getConfigManager, PersonalError, ScheduleError } from '@zeffuro/fakegaming-common/managers';
import { CalendarConnection, CalendarSource, PersonalSchedule } from '@zeffuro/fakegaming-common/models';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateParams, validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { buildTodayAgenda, validAgendaTimezone } from '../personalToday/agenda.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';

const router = createBaseRouter();
const idSchema = z.object({ id: z.string().uuid() }).strict();
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const minutes = z.number().int().min(1).max(525_600);
const taskSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('done'), version }).strict(),
    z.object({ action: z.literal('undo'), version }).strict(),
    z.object({ action: z.literal('tomorrow'), version }).strict(),
    z.object({ action: z.literal('snooze'), version, minutes }).strict(),
    z.object({ action: z.literal('check'), version, index: z.number().int().min(0).max(9) }).strict(),
]);
const scheduleSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('complete'), version }).strict(),
    z.object({ action: z.literal('snooze'), version, minutes }).strict(),
]);
const sessionSchema = z.object({ action: z.enum(['pause', 'resume', 'stop']), version }).strict();

router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Accept-Language');
    const user = (req as Partial<AuthenticatedRequest>).user;
    if (!user || typeof user.discordId !== 'string' || !user.discordId || isServiceRequest(req) || user.discordId.startsWith('service:')) {
        sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'unauthorized');
        return;
    }
    next();
});
const owner = (req: Request) => (req as AuthenticatedRequest).user.discordId;

async function safely(req: Request, res: Response, action: () => Promise<unknown>) {
    try { res.json(await action()); } catch (error) {
        if (!(error instanceof PersonalError) && !(error instanceof ScheduleError)) throw error;
        const status = error.code === 'missing' ? 404 : error.code === 'stale' ? 409 : 400;
        const key = error.code === 'missing' ? 'todayMissing' : error.code === 'stale' ? 'todayStale' : 'todayInvalid';
        sendLocalizedError(req, res, status, error.code.toUpperCase(), key);
    }
}

/**
 * @openapi
 * /personalToday:
 *   get:
 *     summary: Get the authenticated owner's agenda in their saved timezone
 *     tags: [PersonalToday]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Today and overdue tasks, reminders, schedules, upcoming countdowns and active session }
 * /personalToday/tasks/{id}:
 *   patch:
 *     summary: Complete, undo completion, snooze or toggle an owner task with a version check
 *     tags: [PersonalToday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated private task }
 * /personalToday/schedules/{id}:
 *   patch:
 *     summary: Complete or snooze an owner schedule occurrence with a version check
 *     tags: [PersonalToday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated private occurrence }
 * /personalToday/sessions/{id}:
 *   patch:
 *     summary: Pause, resume or stop an owner session with a version check
 *     tags: [PersonalToday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated private session }
 */
router.get('/', validateQuery(z.object({}).strict()), async (req, res) => {
    const userId = owner(req);
    const cm = getConfigManager();
    const [settings, tasks, reminders, schedules, countdowns, session, enabled, connection, sources] = await Promise.all([
        cm.userManager.getOnePlain({ discordId: userId }),
        cm.userTaskManager.list(userId), cm.reminderManager.listForUser(userId),
        cm.userScheduleManager.list(userId, 'all'), cm.userCountdownManager.list(userId),
        cm.userSessionManager.getActive(userId),
        PersonalSchedule.findAll({ where: { userId, enabled: true }, attributes: ['id', 'sourceId'] }),
        CalendarConnection.findByPk(userId, { attributes: ['status'] }),
        CalendarSource.findAll({ where: { userId, enabled: true }, attributes: ['id'] }),
    ]);
    const timezone = validAgendaTimezone(settings?.timezone);
    const now = Date.now();
    const activeSources = new Set(sources.map(item => item.id));
    const enabledScheduleIds = new Set(enabled.filter(item => item.sourceId === null
        || (connection?.status === 'connected' && activeSources.has(item.sourceId))).map(item => item.id));
    const agenda = buildTodayAgenda({ now, timezone, tasks, reminders, schedules, countdowns, enabledScheduleIds });
    res.json({ ...agenda, session: session && ['running', 'paused'].includes(session.state) ? {
        id: session.id, title: session.title, kind: session.kind, state: session.state,
        phase: session.phase, workMs: session.workMs, breakElapsedMs: session.breakElapsedMs,
        remainingMs: session.remainingMs, version: session.version,
    } : null });
});
router.patch('/tasks/:id', validateParams(idSchema), validateBody(taskSchema), async (req, res) => safely(req, res, async () => {
    const { id } = req.params as z.infer<typeof idSchema>;
    const body = req.body as z.infer<typeof taskSchema>;
    const manager = getConfigManager().userTaskManager;
    if (body.action === 'done') return manager.done(id, owner(req), body.version);
    if (body.action === 'undo') return manager.undo(id, owner(req), body.version);
    if (body.action === 'tomorrow') return manager.tomorrow(id, owner(req), body.version);
    if (body.action === 'check') return manager.check(id, owner(req), body.version, body.index);
    return manager.snooze(id, owner(req), body.version, Date.now() + body.minutes * 60_000);
}));
router.patch('/schedules/:id', validateParams(idSchema), validateBody(scheduleSchema), async (req, res) => safely(req, res, async () => {
    const { id } = req.params as z.infer<typeof idSchema>;
    const body = req.body as z.infer<typeof scheduleSchema>;
    const manager = getConfigManager().userScheduleManager;
    return body.action === 'complete' ? manager.complete(id, owner(req), body.version)
        : manager.snooze(id, owner(req), body.version, Date.now() + body.minutes * 60_000, true);
}));
router.patch('/sessions/:id', validateParams(idSchema), validateBody(sessionSchema), async (req, res) => safely(req, res, async () => {
    const { id } = req.params as z.infer<typeof idSchema>;
    const body = req.body as z.infer<typeof sessionSchema>;
    return getConfigManager().userSessionManager.transition(id, owner(req), body.version, body.action);
}));

export { router };
