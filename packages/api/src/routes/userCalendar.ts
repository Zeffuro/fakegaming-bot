import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CalendarConnection, CalendarSource } from '@zeffuro/fakegaming-common/models';
import { getConfigManager, serializedTransaction } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateParams, validateQuery } from '../localization/validation.js';
import { apiText, requestLocale } from '../localization/locale.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { beginCalendarConnection, calendarStatus, CalendarError, completeCalendarConnection, disconnectCalendar } from '../googleCalendar/auth.js';
import { listGoogleCalendars } from '../googleCalendar/client.js';
import { syncCalendarSource } from '../googleCalendar/sync.js';

const router = createBaseRouter();
const owner = (req: Request) => (req as AuthenticatedRequest).user.discordId;
const idSchema = z.object({ id: z.string().uuid() });
const selectionSchema = z.object({ calendarId: z.string().min(1).max(1024), titleFilter: z.string().trim().max(200).nullable().optional() }).strict();
const browserSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const connectSchema = z.object({ browserBinding: browserSchema }).strict();
const completeSchema = z.object({ code: z.string().min(1).max(4096), state: browserSchema, browserBinding: browserSchema }).strict();
const errorKeys = {
    not_configured: 'calendarNotConfigured', not_connected: 'calendarNotConnected', invalid_state: 'calendarInvalidState',
    invalid_token: 'calendarInvalidToken', provider_unavailable: 'calendarProviderUnavailable', invalid_snapshot: 'calendarInvalidSnapshot',
    conflict: 'calendarConflict', not_found: 'googleCalendarSelectionNotFound',
} as const;

/**
 * @openapi
 * /userCalendar:
 *   get:
 *     summary: Get safe personal calendar status and selections
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Connection status and owner calendar selections without credentials }
 *   delete:
 *     summary: Disconnect personal Google Calendar and pause imports while preserving history
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Credentials removed and calendar selections paused }
 * /userCalendar/connect:
 *   post:
 *     summary: Begin owner and browser bound Google OAuth with PKCE
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Authorization URL and single-use state }
 * /userCalendar/complete:
 *   post:
 *     summary: Complete owner and browser bound Google Calendar OAuth
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Encrypted credentials stored }
 * /userCalendar/calendars:
 *   get:
 *     summary: List calendars readable by the authenticated Google account
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fully paginated calendar list }
 * /userCalendar/sources:
 *   post:
 *     summary: Select an owner calendar and optional title substring filter
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Selection saved and initial synchronization attempted }
 * /userCalendar/sources/{id}:
 *   delete:
 *     summary: Stop following an owner calendar selection and retain completion history
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Calendar selection paused }
 * /userCalendar/sources/{id}/sync:
 *   post:
 *     summary: Synchronize a selected owner calendar from an authoritative provider window
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Calendar synchronization completed }
 * /userCalendar/export:
 *   get:
 *     summary: Download all retained owner completion history without provider credentials
 *     tags: [UserCalendar]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: format, required: true, schema: { type: string, enum: [json, csv] } }
 *     responses:
 *       200: { description: JSON backup or CSV history download }
 */

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); res.vary('Accept-Language'); next(); });
async function safely(req: Request, res: Response, action: () => Promise<void>) {
    try { await action(); } catch (error) {
        if (!(error instanceof CalendarError)) {
            res.status(503).json({ error: { code: 'PROVIDER_UNAVAILABLE', message: apiText(requestLocale(req), 'calendarProviderUnavailable') } });
            return;
        }
        const status = error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409
            : ['not_configured', 'provider_unavailable', 'invalid_snapshot'].includes(error.code) ? 503 : 400;
        res.status(status).json({ error: { code: error.code.toUpperCase(), message: apiText(requestLocale(req), errorKeys[error.code]) } });
    }
}

router.get('/', async (req, res) => {
    const userId = owner(req);
    const sources = await CalendarSource.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
    res.json({ ...await calendarStatus(userId), sources });
});
router.post('/connect', validateBody(connectSchema), async (req, res) => safely(req, res, async () => { res.json(await beginCalendarConnection(owner(req), req.body.browserBinding)); }));
router.post('/complete', validateBody(completeSchema), async (req, res) => safely(req, res, async () => {
    await completeCalendarConnection(owner(req), req.body.code, req.body.state, req.body.browserBinding); res.json({ success: true });
}));
router.delete('/', async (req, res) => {
    const userId = owner(req);
    await disconnectCalendar(userId);
    res.json({ success: true });
});
router.get('/calendars', async (req, res) => safely(req, res, async () => { res.json({ calendars: await listGoogleCalendars(owner(req)) }); }));
router.get('/export', validateQuery(z.object({ format: z.enum(['json', 'csv']) }).strict()), async (req, res) => {
    const format = req.query.format as 'json' | 'csv';
    const body = await getConfigManager().userScheduleManager.export(owner(req), format);
    res.setHeader('Content-Disposition', `attachment; filename="schedule-history.${format}"`);
    res.type(format === 'json' ? 'application/json' : 'text/csv').send(body);
});
router.post('/sources', validateBody(selectionSchema), async (req, res) => safely(req, res, async () => {
    const userId = owner(req);
    const calendar = (await listGoogleCalendars(userId)).find(value => value.id === req.body.calendarId);
    if (!calendar) throw new CalendarError('not_found');
    const source = await serializedTransaction(CalendarSource.sequelize!, async transaction => {
        const connection = await CalendarConnection.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (connection?.status !== 'connected') throw new CalendarError('not_connected');
        if (await CalendarSource.count({ where: { userId, enabled: true }, transaction }) >= 10) throw new CalendarError('conflict');
        const previous = await CalendarSource.findOne({ where: { userId, calendarId: calendar.id, titleFilter: req.body.titleFilter || null }, transaction });
        if (previous) {
            if (previous.enabled) throw new CalendarError('conflict');
            return previous.update({ enabled: true, version: previous.version + 1, lastSyncedAt: null }, { transaction });
        }
        return CalendarSource.create({ id: randomUUID(), userId, calendarId: calendar.id, label: calendar.summary.slice(0, 250), timezone: calendar.timeZone,
            titleFilter: req.body.titleFilter || null, enabled: true, version: 1 }, { transaction });
    });
    let syncPending = false;
    try { await syncCalendarSource(source); } catch { syncPending = true; }
    res.status(201).json({ source, syncPending });
}));
router.post('/sources/:id/sync', validateParams(idSchema), async (req, res) => safely(req, res, async () => {
    const source = await CalendarSource.findOne({ where: { id: req.params.id as string, userId: owner(req), enabled: true } });
    if (!source) throw new CalendarError('not_found');
    await syncCalendarSource(source); res.json({ success: true });
}));
router.delete('/sources/:id', validateParams(idSchema), async (req, res) => safely(req, res, async () => {
    const userId = owner(req);
    const source = await CalendarSource.findOne({ where: { id: req.params.id as string, userId } });
    if (!source) throw new CalendarError('not_found');
    await getConfigManager().userScheduleManager.deactivateSource(source.id, userId);
    res.json({ success: true });
}));

export { router };
