import type { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { z } from 'zod';
import { TwitchClipConfig } from '@zeffuro/fakegaming-common/models';
import { twitchClipCreateRequestSchema, twitchClipUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtOrService } from '../middleware/auth.js';
import { checkUserGuildAccess, checkGuildScopedUpdateAccess } from '../utils/authHelpers.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { validateBody, validateQuery, validateParams } from '../localization/validation.js';
import { apiText, requestLocale } from '../localization/locale.js';
import type { ApiCopyKey } from '../localization/catalog.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { beginTwitchClipBotConnection, completeTwitchClipBotConnection, disconnectTwitchClipBot,
    getTwitchClipBotStatus, TwitchClipAuthError } from '../twitchClips/botAuth.js';
import { getTwitchClipRuntimeStatus } from '../twitchClips/runtimeStatus.js';
import { resolveTwitchClipBroadcaster, validateTwitchClipDestination, TwitchClipConfigError } from '../twitchClips/configValidation.js';

const router = createBaseRouter();
const guildQuerySchema = z.object({ guildId: z.string().min(1) });
const idSchema = z.object({ id: z.string().uuid() });
const completeSchema = z.object({ code: z.string().min(1).max(2048), state: z.string().min(1).max(128) }).strict();
const errorKeys = {
    not_configured: 'twitchClipBotNotConfigured', not_connected: 'twitchClipBotNotConnected',
    invalid_state: 'twitchClipOAuthStateInvalid', identity_mismatch: 'twitchClipBotIdentityMismatch',
    invalid_token: 'twitchClipBotTokenInvalid', provider_unavailable: 'twitchClipProviderUnavailable',
    invalid_channel: 'twitchClipInvalidChannel', streamer_not_found: 'twitchClipStreamerNotFound',
} as const satisfies Record<string, ApiCopyKey>;

router.use(jwtOrService, (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Accept-Language');
    next();
});

function sendError(req: Request, res: Response, status: number, key: ApiCopyKey, code: string): void {
    res.status(status).json({ error: { code, message: apiText(requestLocale(req), key) } });
}

async function safely(req: Request, res: Response, operation: () => Promise<void>): Promise<void> {
    try {
        await operation();
    } catch (error) {
        if (error instanceof TwitchClipAuthError || error instanceof TwitchClipConfigError) {
            const status = error.code === 'provider_unavailable' || error.code === 'not_configured' ? 503 : 400;
            sendError(req, res, status, errorKeys[error.code], error.code.toUpperCase());
            return;
        }
        if (error instanceof UniqueConstraintError) {
            sendError(req, res, 409, 'twitchClipDuplicate', 'CONFLICT');
            return;
        }
        throw error;
    }
}

function actorId(req: Request): string {
    const id = isServiceRequest(req) ? req.header('x-dashboard-admin-user') : (req as AuthenticatedRequest).user?.discordId;
    if (!id) throw new TwitchClipAuthError('invalid_state');
    return id;
}

/**
 * @openapi
 * /twitchClips/bot/status:
 *   get:
 *     summary: Get safe Twitch clip bot connection status
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Bot identity and chat listener status without credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configured: { type: boolean }
 *                 connected: { type: boolean }
 *                 login: { type: string, nullable: true }
 *                 expectedLogin: { type: string, nullable: true }
 *                 jobsEnabled: { type: boolean }
 *                 chatReplyAuthorized: { type: boolean }
 *                 chatConnected: { type: boolean }
 *                 subscribedChannels: { type: integer }
 *                 lastErrorCode: { type: string, nullable: true }
 * /twitchClips/bot/connect:
 *   post:
 *     summary: Begin dashboard-administrator Twitch bot OAuth
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OAuth authorization URL and single-use state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 state: { type: string }
 * /twitchClips/bot/complete:
 *   post:
 *     summary: Complete dashboard-administrator Twitch bot OAuth
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, state]
 *             additionalProperties: false
 *             properties:
 *               code: { type: string }
 *               state: { type: string }
 *     responses:
 *       200: { description: Bot connected and encrypted credentials stored }
 * /twitchClips/bot:
 *   delete:
 *     summary: Disconnect the Twitch clip bot as a dashboard administrator
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Stored bot credentials and pending OAuth states removed }
 */
router.get('/bot/status', async (_req, res) => {
    res.json({ ...await getTwitchClipBotStatus(), ...getTwitchClipRuntimeStatus() });
});

router.post('/bot/connect', requireDashboardAdmin, async (req, res) => {
    await safely(req, res, async () => {
        res.json(await beginTwitchClipBotConnection(actorId(req)));
    });
});

router.post('/bot/complete', requireDashboardAdmin, validateBody(completeSchema), async (req, res) => {
    await safely(req, res, async () => {
        await completeTwitchClipBotConnection(actorId(req), req.body.code, req.body.state);
        await recordAuditEvent(req, { action: 'twitchClip.bot.connect', targetType: 'twitchClipBot', targetId: 'default', actorId: actorId(req) });
        res.json({ success: true });
    });
});

router.delete('/bot', requireDashboardAdmin, async (req, res) => {
    await disconnectTwitchClipBot();
    await recordAuditEvent(req, { action: 'twitchClip.bot.disconnect', targetType: 'twitchClipBot', targetId: 'default', actorId: actorId(req) });
    res.json({ success: true });
});

/**
 * @openapi
 * /twitchClips:
 *   get:
 *     summary: List guild Twitch chat clip configurations
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: guildId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Guild clip configurations
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/TwitchClipConfig' } }
 *   post:
 *     summary: Create a guild Twitch chat clip configuration
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TwitchClipCreateRequest' }
 *     responses:
 *       201: { description: Clip configuration created }
 * /twitchClips/{id}:
 *   put:
 *     summary: Update a guild Twitch chat clip configuration
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TwitchClipUpdateRequest' }
 *     responses:
 *       200: { description: Clip configuration updated }
 *   delete:
 *     summary: Delete a guild Twitch chat clip configuration
 *     tags: [TwitchClips]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Clip configuration deleted }
 */
router.get('/', validateQuery(guildQuerySchema), async (req, res) => {
    const guildId = req.query.guildId as string;
    if (!(await checkUserGuildAccess(req, res, guildId)).authorized) return;
    res.json(await TwitchClipConfig.findAll({ where: { guildId } }));
});

router.post('/', validateBody(twitchClipCreateRequestSchema), async (req, res) => {
    const body = req.body as z.output<typeof twitchClipCreateRequestSchema>;
    if (!(await checkUserGuildAccess(req, res, body.guildId)).authorized) return;
    await safely(req, res, async () => {
        await validateTwitchClipDestination(body.guildId, body.discordChannelId);
        const identity = await resolveTwitchClipBroadcaster(body.twitchUsername);
        const config = await TwitchClipConfig.create({ ...body, ...identity, aliases: [...new Set(body.aliases)], replyTemplate: body.replyTemplate || null });
        await recordAuditEvent(req, { action: 'twitchClip.create', targetType: 'twitchClipConfig', targetId: config.id,
            guildId: config.guildId, metadata: { channelId: config.discordChannelId, twitchUsername: config.twitchUsername } });
        res.status(201).json(config);
    });
});

router.put('/:id', validateParams(idSchema), validateBody(twitchClipUpdateRequestSchema), async (req, res) => {
    const config = await TwitchClipConfig.findByPk(req.params.id as string);
    if (!config) { sendError(req, res, 404, 'twitchClipConfigNotFound', 'NOT_FOUND'); return; }
    const body = req.body as z.output<typeof twitchClipUpdateRequestSchema>;
    if (!await checkGuildScopedUpdateAccess(req, res, config, body.guildId)) return;
    await safely(req, res, async () => {
        await validateTwitchClipDestination(body.guildId ?? config.guildId, body.discordChannelId ?? config.discordChannelId);
        const identity = body.twitchUsername ? await resolveTwitchClipBroadcaster(body.twitchUsername) : {};
        await config.update({ ...body, ...identity, ...(body.aliases ? { aliases: [...new Set(body.aliases)] } : {}),
            ...(body.replyTemplate !== undefined ? { replyTemplate: body.replyTemplate || null } : {}) });
        await recordAuditEvent(req, { action: 'twitchClip.update', targetType: 'twitchClipConfig', targetId: config.id,
            guildId: config.guildId, metadata: { channelId: config.discordChannelId } });
        res.json(config);
    });
});

router.delete('/:id', validateParams(idSchema), async (req, res) => {
    const config = await TwitchClipConfig.findByPk(req.params.id as string);
    if (!config) { sendError(req, res, 404, 'twitchClipConfigNotFound', 'NOT_FOUND'); return; }
    if (!(await checkUserGuildAccess(req, res, config.guildId)).authorized) return;
    await config.destroy();
    await recordAuditEvent(req, { action: 'twitchClip.delete', targetType: 'twitchClipConfig', targetId: config.id,
        guildId: config.guildId, metadata: { channelId: config.discordChannelId } });
    res.json({ success: true });
});

export { router };
