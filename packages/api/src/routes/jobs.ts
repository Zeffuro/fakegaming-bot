import { Router, type Request } from 'express';
import { jwtOrService } from '../middleware/auth.js';
import { getActiveJobQueue, getLastHeartbeat } from '../jobs/bootstrap.js';
import { validateBody } from '@zeffuro/fakegaming-common';
import { jobRunRequestSchema } from '@zeffuro/fakegaming-common/api';
import { getJobRuns } from '../jobs/status.js';
import type { JobRunEntry } from '../jobs/status.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { Op } from 'sequelize';
import { JobRun } from '@zeffuro/fakegaming-common';
import { recordAuditEvent } from '../utils/audit.js';
import { requireDashboardAdminOrService } from '../utils/dashboardAdmin.js';

const router = Router();

const ALLOWED_JOBS: Record<string, { queueName: string; acceptsDate?: boolean; acceptsForce?: boolean; runNames?: string[] }> = {
    birthdays: { queueName: 'birthdays:run', acceptsDate: true, acceptsForce: true },
    heartbeat: { queueName: 'heartbeat', acceptsDate: false, acceptsForce: false },
    reminders: { queueName: 'reminders:run', acceptsDate: false, acceptsForce: false },
    patchnotes: { queueName: 'patchnotes:run', acceptsDate: false, acceptsForce: false },
    twitch: { queueName: 'twitch:poll', acceptsDate: false, acceptsForce: false },
    youtube: { queueName: 'youtube:poll', acceptsDate: false, acceptsForce: false },
    tiktok: { queueName: 'tiktok:poll', acceptsDate: false, acceptsForce: false },
    bluesky: { queueName: 'bluesky:poll', acceptsDate: false, acceptsForce: false },
    anime: { queueName: 'anime:notifications', acceptsDate: false, acceptsForce: false, runNames: ['anime-notifications'] },
};
const requireJobsAdmin = [jwtOrService, requireDashboardAdminOrService] as const;

async function recordJobRunAudit(req: Request, name: string, def: { queueName: string }, status: 'success' | 'failure', metadata: Record<string, unknown>): Promise<void> {
    await recordAuditEvent(req, {
        action: 'job.run',
        targetType: 'job',
        targetId: name,
        status,
        severity: status === 'failure' ? 'error' : 'info',
        metadata: {
            queueName: def.queueName,
            ...metadata,
        },
    });
}

/**
 * @openapi
 * /jobs:
 *   get:
 *     summary: List allowed jobs and their capabilities
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', ...requireJobsAdmin, async (_req, res) => {
    const jobs = Object.entries(ALLOWED_JOBS).map(([name, cfg]) => ({ name, supportsDate: !!cfg.acceptsDate, supportsForce: !!cfg.acceptsForce }));
    res.json({ jobs });
});

/**
 * @openapi
 * /jobs/heartbeat/last:
 *   get:
 *     summary: Get the last heartbeat payload/time
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last heartbeat info (or null)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/heartbeat/last', ...requireJobsAdmin, async (_req, res) => {
    const last = getLastHeartbeat();
    res.json({ last });
});

/**
 * @openapi
 * /jobs/{name}/status:
 *   get:
 *     summary: Get recent runs for a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *           enum: [birthdays, heartbeat, reminders, patchnotes, twitch, youtube, tiktok, bluesky, anime]
 *     responses:
 *       200:
 *         description: Recent runs for the specified job
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:name/status', ...requireJobsAdmin, async (req, res) => {
    const { name } = req.params as { name: string };
    const def = ALLOWED_JOBS[name];
    if (!def) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Unknown job name: ${name}` } });
    }
    // Prefer DB-backed recent runs; fallback to in-memory if none
    const dbNames = [name, ...(def.runNames ?? [])];
    const dbRuns = await JobRun.findAll({
        where: { name: dbNames.length === 1 ? name : { [Op.in]: dbNames } },
        order: [['startedAt', 'DESC']],
        limit: 10,
    });
    let runs: JobRunEntry[] = dbRuns.map(r => ({
        startedAt: r.startedAt?.toISOString?.() ?? new Date(r.get('startedAt') as any).toISOString(),
        finishedAt: r.finishedAt?.toISOString?.() ?? new Date(r.get('finishedAt') as any).toISOString(),
        ok: r.ok,
        meta: (r.meta as Record<string, unknown> | null) ?? undefined,
        error: (r.error as string | null) ?? undefined,
    }));

    if (runs.length === 0) {
        runs = [
            ...getJobRuns(name),
            ...(def.runNames ?? []).flatMap(runName => getJobRuns(runName)),
        ].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 10);
    }

    res.json({ runs });
});

/**
 * @openapi
 * /jobs/{name}/run:
 *   post:
 *     summary: Manually trigger a job by name
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *           enum: [birthdays, heartbeat, reminders, patchnotes, twitch, youtube, tiktok, bluesky, anime]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JobRunRequest'
 *     responses:
 *       202:
 *         description: Job scheduled
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       503:
 *         description: Jobs not enabled or queue unavailable
 */
router.post('/:name/run', ...requireJobsAdmin, validateBody(jobRunRequestSchema), async (req, res) => {
    const { name } = req.params as { name: string };
    const def = ALLOWED_JOBS[name];
    if (!def) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Unknown job name: ${name}` } });
    }

    const queue = getActiveJobQueue();
    if (!queue) {
        await recordJobRunAudit(req, name, def, 'failure', { reason: 'queue_unavailable' });
        return res.status(503).json({ error: { code: 'JOBS_UNAVAILABLE', message: 'Jobs are not enabled or queue is not initialized' } });
    }

    const payload: Record<string, unknown> = {};
    if (def.acceptsDate) {
        payload.date = typeof req.body?.date === 'string' ? req.body.date : new Date().toISOString();
    }
    if (def.acceptsForce && typeof req.body?.force === 'boolean') {
        payload.force = req.body.force;
    }

    let id: string | number;
    try {
        id = await queue.schedule(def.queueName, payload);
    } catch (err) {
        await recordJobRunAudit(req, name, def, 'failure', {
            reason: 'schedule_failed',
            errorType: err instanceof Error ? err.name : typeof err,
        });
        throw err;
    }

    await recordJobRunAudit(req, name, def, 'success', {
        jobId: id,
        date: typeof payload.date === 'string' ? payload.date : undefined,
        force: typeof payload.force === 'boolean' ? payload.force : undefined,
    });
    res.status(202).json({ ok: true, jobId: id });
});

/**
 * @openapi
 * /jobs/birthdays/today:
 *   get:
 *     summary: Get number of birthday notifications processed today
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count of processed birthdays for today
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/birthdays/today', ...requireJobsAdmin, async (_req, res) => {
    const cm = getConfigManager();
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { count } = await cm.notificationsManager.getAndCountAll({
        where: {
            provider: 'birthday',
            createdAt: { [Op.gte]: start, [Op.lt]: end } as any,
        } as any,
    });
    res.json({ processed: count });
});

export { router };
