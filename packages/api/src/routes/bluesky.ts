import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { blueskyCreateRequestSchema, blueskyUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { existsQuerySchema, idParamSchema, profileQuerySchema } from './bluesky.schemas.js';
import { fetchBlueskyProfile, normalizeBlueskyHandle } from '../jobs/bluesky.js';
import {
    channelAuditMetadata,
    deleteGuildScopedRecord,
    loadGuildScopedRecords,
    sendGuildScopedRecordById,
    sendGuildScopedRecords,
    updateGuildScopedRecord,
    updatedChannelAuditMetadata,
    upsertGuildScopedRecord,
} from '../utils/guildScopedRouteHelpers.js';
import { optionalGuildListQuerySchema } from './sharedSchemas.js';

const router = createBaseRouter();

/**
 * @openapi
 * /bluesky:
 *   get:
 *     summary: List all Bluesky post configs
 *     tags: [Bluesky]
 *     responses:
 *       200:
 *         description: List of Bluesky post configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BlueskyPostConfig'
 */
router.get('/', validateQuery(optionalGuildListQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof optionalGuildListQuerySchema>;
    const configs = await loadGuildScopedRecords(getConfigManager().blueskyManager, guildId);
    await sendGuildScopedRecords(req, res, configs, guildId);
});

/**
 * @openapi
 * /bluesky/exists:
 *   get:
 *     summary: Check if a Bluesky post config exists
 *     tags: [Bluesky]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: blueskyHandle
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
 */
router.get('/exists', jwtAuth, validateQuery(existsQuerySchema), requireGuildAdmin, async (req, res) => {
    const { blueskyHandle, discordChannelId, guildId } = req.query as unknown as z.output<typeof existsQuerySchema>;
    const normalized = normalizeBlueskyHandle(blueskyHandle);
    const exists = normalized
        ? await getConfigManager().blueskyManager.exists({ blueskyHandle: normalized, discordChannelId, guildId })
        : false;
    res.json({ exists });
});

/**
 * @openapi
 * /bluesky/profile:
 *   get:
 *     summary: Resolve public Bluesky profile metadata
 *     tags: [Bluesky]
 *     parameters:
 *       - in: query
 *         name: handle
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile resolution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 did:
 *                   type: string
 *                 handle:
 *                   type: string
 *                 displayName:
 *                   type: string
 *                 avatar:
 *                   type: string
 */
router.get('/profile', validateQuery(profileQuerySchema), async (req, res) => {
    const { handle } = req.query as unknown as z.output<typeof profileQuerySchema>;
    try {
        const profile = await fetchBlueskyProfile(handle);
        if (!profile) return res.json({ exists: false });
        return res.json({ exists: true, ...profile });
    } catch {
        return res.json({ exists: false });
    }
});

/**
 * @openapi
 * /bluesky/{id}:
 *   get:
 *     summary: Get a Bluesky post config by id
 *     tags: [Bluesky]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bluesky post config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlueskyPostConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().blueskyManager;
    await sendGuildScopedRecordById(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        notFoundMessage: 'Bluesky post config not found',
    });
});

/**
 * @openapi
 * /bluesky:
 *   post:
 *     summary: Create a new Bluesky post config
 *     tags: [Bluesky]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates or updates a Bluesky post configuration for a guild+handle pair.
 *       Read-only fields: lastPostUri, lastPostCid, lastNotifiedAt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlueskyCreateRequest'
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
 */
router.post('/', jwtAuth, validateBody(blueskyCreateRequestSchema), requireGuildAdmin, async (req, res) => {
    const body = req.body as z.infer<typeof blueskyCreateRequestSchema>;
    const blueskyHandle = normalizeBlueskyHandle(body.blueskyHandle);
    if (!blueskyHandle) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'blueskyHandle is required' } });
    }
    const normalizedBody = { ...body, blueskyHandle };
    const manager = getConfigManager().blueskyManager;
    await upsertGuildScopedRecord(req, res, normalizedBody, {
        upsert: data => manager.upsert(data, ['guildId', 'blueskyHandle']),
        createAction: 'bluesky.create',
        updateAction: 'bluesky.update',
        targetType: 'blueskyConfig',
        targetId: data => data.blueskyHandle,
        metadata: data => channelAuditMetadata(data),
    });
});

/**
 * @openapi
 * /bluesky/{id}:
 *   put:
 *     summary: Update a Bluesky post config by id
 *     tags: [Bluesky]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlueskyUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlueskyPostConfig'
 */
router.put('/:id', jwtAuth, validateParams(idParamSchema), validateBody(blueskyUpdateRequestSchema), async (req, res) => {
    const body = req.body as z.infer<typeof blueskyUpdateRequestSchema>;
    const normalized = typeof body.blueskyHandle === 'string' ? normalizeBlueskyHandle(body.blueskyHandle) : undefined;
    if (typeof body.blueskyHandle === 'string' && !normalized) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'blueskyHandle is required' } });
    }
    const normalizedBody = { ...body, ...(normalized ? { blueskyHandle: normalized } : {}) };
    const manager = getConfigManager().blueskyManager;
    await updateGuildScopedRecord(req, res, Number(req.params.id), normalizedBody, {
        findByPk: id => manager.findByPkPlain(id),
        update: (id, data) => manager.updatePlain(data, { id }),
        notFoundMessage: 'Bluesky post config not found',
        auditAction: 'bluesky.update',
        auditTargetType: 'blueskyConfig',
        auditMetadata: (updated, previous) => updatedChannelAuditMetadata(updated, previous),
    });
});

/**
 * @openapi
 * /bluesky/{id}:
 *   delete:
 *     summary: Delete a Bluesky post config by id
 *     tags: [Bluesky]
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
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const manager = getConfigManager().blueskyManager;
    await deleteGuildScopedRecord(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        removeByPk: id => manager.removeByPk(id),
        notFoundMessage: 'Bluesky post config not found',
        auditAction: 'bluesky.delete',
        auditTargetType: 'blueskyConfig',
        auditMetadata: config => channelAuditMetadata(config),
    });
});

export { router };
