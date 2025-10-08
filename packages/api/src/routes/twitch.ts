import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { TwitchStreamConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';

const router = createBaseRouter();

// ✨ Single source of truth - schemas derived lazily via model
const idParamSchema = z.object({ id: z.coerce.number() });
const existsQuerySchema = z.object({
    twitchUsername: z.string().min(1),
    discordChannelId: z.string().min(1),
    guildId: z.string().min(1)
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
 */
router.get('/exists', jwtAuth, async (req, res) => {
    const parsed = existsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Missing or invalid query parameters' });
    }
    const { twitchUsername, discordChannelId, guildId } = parsed.data;
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
 */
router.post('/', jwtAuth, requireGuildAdmin, validateBodyForModel(TwitchStreamConfig, 'create'), async (req, res) => {
    await getConfigManager().twitchManager.addPlain(req.body);
    res.status(201).json({ success: true });
});

/**
 * @openapi
 * /twitch/{id}:
 *   put:
 *     summary: Update a Twitch stream config by id
 *     tags: [Twitch]
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
 */
router.delete('/:id', jwtAuth, async (req, res, next) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
        return next(new Error('Database error'));
    }
    const numericId = Number(id);
    const stream = await getConfigManager().twitchManager.findByPkPlain(numericId);
    if (!stream) return res.status(404).json({ error: 'Twitch stream config not found' });
    if (stream.guildId) {
        const access = await checkUserGuildAccess(req, res, stream.guildId);
        if (!access.authorized) return;
    }
    await getConfigManager().twitchManager.remove({ id: numericId } as any);
    res.json({ success: true });
});

export { router };
