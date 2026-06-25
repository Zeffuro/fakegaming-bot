import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { twitchCreateRequestSchema, twitchUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { getLogger } from '@zeffuro/fakegaming-common';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth, jwtOrService } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { requireDashboardAdminOrService } from '../utils/dashboardAdmin.js';
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
import { numericIdParamSchema, optionalGuildListQuerySchema } from './sharedSchemas.js';

// Schemas
const existsQuerySchema = z.object({
    twitchUsername: z.string().min(1),
    discordChannelId: z.string().min(1),
    guildId: z.string().min(1)
});

const router = createBaseRouter();

const log = getLogger({ name: 'api:routes:twitch' });

// Accept both username and twitchUsername; allow string or string[], and normalize to a single username string
const verifyQuerySchema = z.object({
    username: z.union([z.string(), z.array(z.string())]).optional(),
    twitchUsername: z.union([z.string(), z.array(z.string())]).optional()
}).refine((q) => {
    const raw = q.username ?? q.twitchUsername;
    if (Array.isArray(raw)) return (raw[0]?.trim().length ?? 0) > 0;
    return typeof raw === 'string' && raw.trim().length > 0;
}, { message: 'username is required', path: ['username'] }).transform((q) => {
    const raw = q.username ?? q.twitchUsername;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return { username: (v ?? '').trim() };
});

/**
 * @openapi
 * /twitch:
 *   get:
 *     summary: List all Twitch stream configs
 *     tags: [Twitch]
 *     responses:
 *       200:
 *         description: List of Twitch stream configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TwitchStreamConfig'
 */
router.get('/', validateQuery(optionalGuildListQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof optionalGuildListQuerySchema>;
    const streams = await loadGuildScopedRecords(getConfigManager().twitchManager, guildId);
    await sendGuildScopedRecords(req, res, streams, guildId);
});

/**
 * @openapi
 * /twitch/exists:
 *   get:
 *     summary: Check if a Twitch stream config exists
 *     tags: [Twitch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: twitchUsername
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
    const { twitchUsername, discordChannelId, guildId } = req.query as z.infer<typeof existsQuerySchema>;
    const exists = await getConfigManager().twitchManager.exists({ twitchUsername, discordChannelId, guildId });
    res.json({ exists });
});

/**
 * @openapi
 * /twitch/verify:
 *   get:
 *     summary: Verify a Twitch username exists
 *     tags: [Twitch]
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 id:
 *                   type: string
 *                 login:
 *                   type: string
 *                 displayName:
 *                   type: string
 */
router.get('/verify', jwtOrService, requireDashboardAdminOrService, validateQuery(verifyQuerySchema), async (req, res) => {
    const { username } = req.query as z.infer<typeof verifyQuerySchema>;
    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        log.warn('TWITCH_CLIENT_ID/SECRET missing; cannot verify');
        return res.json({ exists: false });
    }
    try {
        const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`, { method: 'POST' });
        if (!tokenRes.ok) return res.json({ exists: false });
        const tokenData = await tokenRes.json() as { access_token: string };
        const usersRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Client-Id': clientId }
        });
        if (!usersRes.ok) return res.json({ exists: false });
        const data = await usersRes.json();
        const user = (data?.data ?? [])[0];
        if (!user) return res.json({ exists: false });
        return res.json({ exists: true, id: String(user.id ?? ''), login: String(user.login ?? username), displayName: String(user.display_name ?? user.login ?? username) });
    } catch (err) {
        log.error({ err, username }, 'Error verifying Twitch user');
        return res.json({ exists: false });
    }
});

/**
 * @openapi
 * /twitch/{id}:
 *   get:
 *     summary: Get a Twitch stream config by id
 *     tags: [Twitch]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Twitch stream config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TwitchStreamConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(numericIdParamSchema), async (req, res) => {
    const manager = getConfigManager().twitchManager;
    await sendGuildScopedRecordById(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        notFoundMessage: 'Twitch stream config not found',
    });
});

/**
 * @openapi
 * /twitch:
 *   post:
 *     summary: Create a new Twitch stream config
 *     tags: [Twitch]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates or updates a Twitch stream configuration for a guild+streamer pair.
 *       Allowed fields in request body:
 *       - twitchUsername (string, required)
 *       - discordChannelId (string, required)
 *       - guildId (string, required)
 *       - customMessage (string, optional)
 *       - cooldownMinutes (integer >= 0 or null, optional)
 *       - quietHoursStart (HH:mm or null, optional)
 *       - quietHoursEnd (HH:mm or null, optional)
 *       - paused (boolean, optional)
 *       - vodFollowupEnabled (boolean, optional)
 *       - vodFollowupDelayMinutes (integer 1-1440 or null, optional)
 *
 *       Read-only fields (ignored if provided): isLive, lastNotifiedAt, lastVodId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TwitchCreateRequest'
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
router.post('/', jwtAuth, validateBody(twitchCreateRequestSchema), requireGuildAdmin, async (req, res) => {
    const body = req.body as z.output<typeof twitchCreateRequestSchema>;
    const manager = getConfigManager().twitchManager;
    await upsertGuildScopedRecord(req, res, body, {
        upsert: data => manager.upsert(data, ['guildId', 'twitchUsername']),
        createAction: 'twitch.create',
        updateAction: 'twitch.update',
        targetType: 'twitchConfig',
        targetId: data => data.twitchUsername,
        metadata: data => channelAuditMetadata(data),
    });
});

/**
 * @openapi
 * /twitch/{id}:
 *   put:
 *     summary: Update a Twitch stream config by id
 *     tags: [Twitch]
 *     description: |
 *       Updates a Twitch stream configuration by id. Allowed fields in request body:
 *       - twitchUsername (string)
 *       - discordChannelId (string)
 *       - guildId (string)
 *       - customMessage (string)
 *       - cooldownMinutes (integer >= 0 or null)
 *       - quietHoursStart (HH:mm or null)
 *       - quietHoursEnd (HH:mm or null)
 *       - paused (boolean)
 *       - vodFollowupEnabled (boolean)
 *       - vodFollowupDelayMinutes (integer 1-1440 or null)
 *
 *       Read-only fields: isLive, lastNotifiedAt, lastVodId.
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
 *             $ref: '#/components/schemas/TwitchUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TwitchStreamConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', jwtAuth, validateParams(numericIdParamSchema), validateBody(twitchUpdateRequestSchema), async (req, res) => {
    const body = req.body as z.output<typeof twitchUpdateRequestSchema>;
    const manager = getConfigManager().twitchManager;
    await updateGuildScopedRecord(req, res, Number(req.params.id), body, {
        findByPk: id => manager.findByPkPlain(id),
        update: (id, data) => manager.updatePlain(data, { id }),
        notFoundMessage: 'Twitch stream config not found',
        auditAction: 'twitch.update',
        auditTargetType: 'twitchConfig',
        auditMetadata: (updated, previous) => updatedChannelAuditMetadata(updated, previous),
    });
});

/**
 * @openapi
 * /twitch/{id}:
 *   delete:
 *     summary: Delete a Twitch stream config by id
 *     tags: [Twitch]
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
router.delete('/:id', jwtAuth, validateParams(numericIdParamSchema), async (req, res) => {
    const manager = getConfigManager().twitchManager;
    await deleteGuildScopedRecord(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        removeByPk: id => manager.removeByPk(id),
        notFoundMessage: 'Twitch stream config not found',
        auditAction: 'twitch.delete',
        auditTargetType: 'twitchConfig',
        auditMetadata: stream => channelAuditMetadata(stream),
    });
});


export { router };
