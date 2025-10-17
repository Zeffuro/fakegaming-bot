import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBodyForModel, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { TwitchStreamConfig } from '@zeffuro/fakegaming-common/models';
import { getLogger } from '@zeffuro/fakegaming-common';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';

// Schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
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
router.get('/', async (_req, res) => {
    const streams = await getConfigManager().twitchManager.getAllPlain();
    res.json(streams);
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
router.get('/exists', jwtAuth, validateQuery(existsQuerySchema), async (req, res) => {
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
router.get('/verify', validateQuery(verifyQuerySchema), async (req, res) => {
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
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const stream = await getConfigManager().twitchManager.findByPkPlain(Number(id));
    if (!stream) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Twitch stream config not found' } });
    res.json(stream);
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
 *
 *       Read-only fields (ignored if provided): isLive, lastNotifiedAt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TwitchStreamConfig'
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
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', jwtAuth, requireGuildAdmin, validateBodyForModel(TwitchStreamConfig, 'create'), async (req, res) => {
    // Upsert by composite unique key (guildId + twitchUsername) to make POST idempotent per guild/streamer
    const created = await getConfigManager().twitchManager.upsert(req.body, ['guildId', 'twitchUsername']);
    res.status(created ? 201 : 200).json({ success: true });
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
 *             $ref: '#/components/schemas/TwitchStreamConfig'
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
router.put('/:id', jwtAuth, validateParams(idParamSchema), validateBodyForModel(TwitchStreamConfig, 'update'), async (req, res) => {
    const { id } = req.params;
    const stream = await getConfigManager().twitchManager.findByPkPlain(Number(id));
    if (!stream) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Twitch stream config not found' } });
    await getConfigManager().twitchManager.updatePlain(req.body, { id: Number(id) });
    const updated = await getConfigManager().twitchManager.findByPkPlain(Number(id));
    res.json(updated);
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
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);
    const stream = await getConfigManager().twitchManager.findByPkPlain(numericId);
    if (!stream) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Twitch stream config not found' } });
    if (stream.guildId) {
        const access = await checkUserGuildAccess(req, res, stream.guildId);
        if (!access.authorized) return;
    }
    await getConfigManager().twitchManager.removeByPk(numericId);
    res.json({ success: true });
});


export { router };
