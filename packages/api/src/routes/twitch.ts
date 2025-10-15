import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBodyForModel, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { TwitchStreamConfig } from '@zeffuro/fakegaming-common/models';
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
 *         description: Query validation failed
 *       401:
 *         description: Unauthorized
 */
router.get('/exists', jwtAuth, validateQuery(existsQuerySchema), async (req, res) => {
    const { twitchUsername, discordChannelId, guildId } = req.query as z.infer<typeof existsQuerySchema>;
    const exists = await getConfigManager().twitchManager.exists({ twitchUsername, discordChannelId, guildId });
    res.json({ exists });
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
 *         description: Not found
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const stream = await getConfigManager().twitchManager.findByPkPlain(Number(id));
    if (!stream) return res.status(404).json({ error: 'Twitch stream config not found' });
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
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — requires guild admin
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
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put('/:id', jwtAuth, validateParams(idParamSchema), validateBodyForModel(TwitchStreamConfig, 'update'), async (req, res) => {
    const { id } = req.params;
    const stream = await getConfigManager().twitchManager.findByPkPlain(Number(id));
    if (!stream) return res.status(404).json({ error: 'Twitch stream config not found' });
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
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — insufficient guild access
 *       404:
 *         description: Not found
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);
    const stream = await getConfigManager().twitchManager.findByPkPlain(numericId);
    if (!stream) return res.status(404).json({ error: 'Twitch stream config not found' });
    if (stream.guildId) {
        const access = await checkUserGuildAccess(req, res, stream.guildId);
        if (!access.authorized) return;
    }
    await getConfigManager().twitchManager.removeByPk(numericId);
    res.json({ success: true });
});

export { router };
