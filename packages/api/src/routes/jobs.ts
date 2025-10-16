import { Router } from 'express';
import { jwtAuth } from '../middleware/auth.js';
import { getActiveJobQueue, getLastHeartbeat } from '../jobs/bootstrap.js';
import { z } from 'zod';
import { validateBody } from '@zeffuro/fakegaming-common';
import type { AuthenticatedRequest } from '../types/express.js';
import { getJobRuns } from '../jobs/status.js';
import type { JobRunEntry } from '../jobs/status.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { Op } from 'sequelize';
import { JobRun } from '@zeffuro/fakegaming-common';

const router = Router();

function isDashboardAdmin(discordId: string | undefined): boolean {
    if (!discordId) return false;
    const raw = process.env.DASHBOARD_ADMINS || '';
    const list = raw.split(',').map(s => s.trim()).filter(Boolean);
    return list.includes(discordId);
}

const isoDateTime = z.string().refine((s) => {
    const t = Date.parse(s);
    return !Number.isNaN(t);
}, { message: 'Invalid date-time' });

const runSchema = z.object({
    date: isoDateTime.optional(),
    force: z.boolean().optional()
});

const ALLOWED_JOBS: Record<string, { queueName: string; acceptsDate?: boolean; acceptsForce?: boolean }> = {
    birthdays: { queueName: 'birthdays:run', acceptsDate: true, acceptsForce: true },
    heartbeat: { queueName: 'heartbeat', acceptsDate: false, acceptsForce: false }
};

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
router.get('/', jwtAuth, async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const { discordId } = (req as AuthenticatedRequest).user;
    if (isProd && !isDashboardAdmin(discordId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only dashboard admins can view jobs' } });
    }
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
router.get('/heartbeat/last', jwtAuth, async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const { discordId } = (req as AuthenticatedRequest).user;
    if (isProd && !isDashboardAdmin(discordId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only dashboard admins can view jobs' } });
    }
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
 *           enum: [birthdays, heartbeat]
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
router.get('/:name/status', jwtAuth, async (req, res) => {
    const { name } = req.params as { name: string };
    const def = ALLOWED_JOBS[name];
    if (!def) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Unknown job name: ${name}` } });
    }
    const isProd = process.env.NODE_ENV === 'production';
    const { discordId } = (req as AuthenticatedRequest).user;
    if (isProd && !isDashboardAdmin(discordId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only dashboard admins can view jobs' } });
    }

    // Prefer DB-backed recent runs; fallback to in-memory if none
    const dbRuns = await JobRun.findAll({
        where: { name },
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
        runs = getJobRuns(name);
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
 *           enum: [birthdays, heartbeat]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Optional ISO date to process; supported for specific jobs (e.g., birthdays).
 *               force:
 *                 type: boolean
 *                 description: When true (and supported by the job), bypasses normal idempotency to force re-processing.
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
router.post('/:name/run', jwtAuth, validateBody(runSchema), async (req, res) => {
    const { name } = req.params as { name: string };
    const def = ALLOWED_JOBS[name];
    if (!def) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Unknown job name: ${name}` } });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const { discordId } = (req as AuthenticatedRequest).user;
    if (isProd && !isDashboardAdmin(discordId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only dashboard admins can trigger jobs' } });
    }

    const queue = getActiveJobQueue();
    if (!queue) {
        return res.status(503).json({ error: { code: 'JOBS_UNAVAILABLE', message: 'Jobs are not enabled or queue is not initialized' } });
    }

    const payload: Record<string, unknown> = {};
    if (def.acceptsDate) {
        payload.date = typeof req.body?.date === 'string' ? req.body.date : new Date().toISOString();
    }
    if (def.acceptsForce && typeof req.body?.force === 'boolean') {
        payload.force = req.body.force;
    }

    const id = await queue.schedule(def.queueName, payload);
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
router.get('/birthdays/today', jwtAuth, async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const { discordId } = (req as AuthenticatedRequest).user;
    if (isProd && !isDashboardAdmin(discordId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only dashboard admins can view jobs' } });
    }
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
