import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { tiktokCreateRequestSchema, tiktokUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth, jwtOrService } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { idParamSchema, existsQuerySchema, liveQuerySchema } from './tiktok.schemas.js';
import { resolveTikTokLive as _resolveLive } from '../jobs/tiktok.js';
import { requireDashboardAdminOrService } from '../utils/dashboardAdmin.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    canDeleteGuildScopedRecord,
    canReadGuildScopedRecord,
    canUpdateGuildScopedRecordFromBody,
    channelAuditMetadata,
    sendGuildScopedRecords,
    sendNotFound,
    updatedChannelAuditMetadata,
} from '../utils/guildScopedRouteHelpers.js';
import { optionalGuildListQuerySchema } from './sharedSchemas.js';

const router = createBaseRouter();

/**
 * @openapi
 * /tiktok:
 *   get:
 *     summary: List all TikTok stream configs
 *     tags: [TikTok]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of TikTok stream configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TikTokStreamConfig'
 */
router.get('/', validateQuery(optionalGuildListQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof optionalGuildListQuerySchema>;
    const streams = await getConfigManager().tiktokManager.getAllPlain();
    await sendGuildScopedRecords(req, res, streams, guildId);
});

/**
 * @openapi
 * /tiktok/exists:
 *   get:
 *     summary: Check if a TikTok stream config exists
 *     tags: [TikTok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tiktokUsername
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: discordChannelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Config existence status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/exists', jwtAuth, validateQuery(existsQuerySchema), requireGuildAdmin, async (req, res) => {
    const { tiktokUsername, discordChannelId, guildId } = req.query as unknown as z.output<typeof existsQuerySchema>;
    const manager = getConfigManager().tiktokManager as unknown as { getOne: (where: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown> };
    const existing = await manager.getOne({ tiktokUsername, discordChannelId, guildId }, { raw: true });
    res.json({ exists: !!existing });
});

/**
 * @openapi
 * /tiktok/live:
 *   get:
 *     summary: Get current live status of a TikTok user
 *     tags: [TikTok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Live status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 live:
 *                   type: boolean
 *                 roomId:
 *                   type: string
 *                 title:
 *                   type: string
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 viewers:
 *                   type: integer
 *                 cover:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/live', jwtOrService, requireDashboardAdminOrService, validateQuery(liveQuerySchema), async (req, res) => {
    const { username, debug, mode } = req.query as unknown as z.output<typeof liveQuerySchema>;
    if (mode === 'light') {
        const { live, debugMeta } = await _resolveLive(username, undefined, { mode: 'light' } as any);
        const payload: Record<string, unknown> = { live };
        if (debug) payload.debugMeta = debugMeta ?? null;
        return res.json(payload);
    }
    const info = await _resolveLive(username);
    res.json({
        live: info.live,
        roomId: info.roomId ?? null,
        title: info.title ?? null,
        startedAt: info.startedAt ?? null,
        viewers: info.viewers ?? null,
        cover: info.cover ?? null,
        ...(debug ? { debugMeta: info.debugMeta ?? null } : {})
    });
});

/**
 * @openapi
 * /tiktok/{id}:
 *   get:
 *     summary: Get a TikTok stream config by id
 *     tags: [TikTok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: TikTok stream config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TikTokStreamConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const stream = await getConfigManager().tiktokManager.findByPkPlain(Number(id));
    if (!stream) return sendNotFound(res, 'TikTok stream config not found');
    const hasAccess = await canReadGuildScopedRecord(req, res, stream);
    if (!hasAccess) return;
    res.json(stream);
});

/**
 * @openapi
 * /tiktok:
 *   post:
 *     summary: Create a new TikTok stream config
 *     tags: [TikTok]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates or updates a TikTok stream configuration for a guild+streamer pair.
 *       Allowed fields in request body:
 *       - tiktokUsername (string, required)
 *       - discordChannelId (string, required)
 *       - guildId (string, required)
 *       - customMessage (string, optional)
 *       - cooldownMinutes (integer >= 0 or null, optional)
 *       - quietHoursStart (HH:mm or null, optional)
 *       - quietHoursEnd (HH:mm or null, optional)
 *
 *       Read-only fields (ignored if provided): isLive, lastNotifiedAt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TikTokCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       200:
 *         description: Existing config updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', jwtAuth, validateBody(tiktokCreateRequestSchema), requireGuildAdmin, async (req, res) => {
    const created = await getConfigManager().tiktokManager.upsert(req.body, ['guildId', 'tiktokUsername']);
    await recordAuditEvent(req, {
        action: created ? 'tiktok.create' : 'tiktok.update',
        targetType: 'tiktokConfig',
        targetId: req.body.tiktokUsername,
        guildId: req.body.guildId,
        metadata: channelAuditMetadata(req.body),
    });
    res.status(created ? 201 : 200).json({ success: true });
});

/**
 * @openapi
 * /tiktok/{id}:
 *   put:
 *     summary: Update a TikTok stream config by id
 *     tags: [TikTok]
 *     description: |
 *       Updates a TikTok stream configuration by id. Allowed fields in request body:
 *       - tiktokUsername (string)
 *       - discordChannelId (string)
 *       - guildId (string)
 *       - customMessage (string)
 *       - cooldownMinutes (integer >= 0 or null)
 *       - quietHoursStart (HH:mm or null)
 *       - quietHoursEnd (HH:mm or null)
 *
 *       Read-only fields: isLive, lastNotifiedAt.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TikTokUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TikTokStreamConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', jwtAuth, validateParams(idParamSchema), validateBody(tiktokUpdateRequestSchema), async (req, res) => {
    const id = String(req.params.id);
    const stream = await getConfigManager().tiktokManager.findByPkPlain(Number(id));
    if (!stream) return sendNotFound(res, 'TikTok stream config not found');
    const hasAccess = await canUpdateGuildScopedRecordFromBody(req, res, stream, req.body);
    if (!hasAccess) return;
    await getConfigManager().tiktokManager.updatePlain(req.body, { id: Number(id) });
    const updated = await getConfigManager().tiktokManager.findByPkPlain(Number(id));
    await recordAuditEvent(req, {
        action: 'tiktok.update',
        targetType: 'tiktokConfig',
        targetId: id,
        guildId: updated.guildId ?? stream.guildId ?? null,
        metadata: updatedChannelAuditMetadata(updated, stream),
    });
    res.json(updated);
});

/**
 * @openapi
 * /tiktok/{id}:
 *   delete:
 *     summary: Delete a TikTok stream config by id
 *     tags: [TikTok]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const numericId = Number(id);
    const stream = await getConfigManager().tiktokManager.findByPkPlain(numericId);
    if (!stream) return sendNotFound(res, 'TikTok stream config not found');
    const hasAccess = await canDeleteGuildScopedRecord(req, res, stream);
    if (!hasAccess) return;
    await getConfigManager().tiktokManager.removeByPk(numericId);
    await recordAuditEvent(req, {
        action: 'tiktok.delete',
        targetType: 'tiktokConfig',
        targetId: numericId,
        guildId: stream.guildId ?? null,
        metadata: channelAuditMetadata(stream),
    });
    res.json({ success: true });
});

export { router };
