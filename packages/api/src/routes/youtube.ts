import {Router} from 'express';
import {getConfigManager, cacheGet} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';
import { getStringQueryParam, isGuildAdmin } from '../utils/requestHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();

/**
 * @openapi
 * /youtube:
 *   get:
 *     summary: List all YouTube channel configs
 *     tags: [YouTube]
 *     responses:
 *       200:
 *         description: List of YouTube configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/YoutubeVideoConfig'
 */
router.get('/', async (req, res) => {
    const configs = await getConfigManager().youtubeManager.getAllPlain();
    res.json(configs);
});

/**
 * @openapi
 * /youtube/channel:
 *   get:
 *     summary: Get a YouTube config by youtubeChannelId and discordChannelId
 *     tags: [YouTube]
 *     parameters:
 *       - in: query
 *         name: youtubeChannelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: discordChannelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: YouTube config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoutubeVideoConfig'
 *       404:
 *         description: Not found
 */
router.get('/channel', jwtAuth, async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const youtubeChannelId = getStringQueryParam(req.query, 'youtubeChannelId');
    const discordChannelId = getStringQueryParam(req.query, 'discordChannelId');
    const guildId = getStringQueryParam(req.query, 'guildId');
    if (!youtubeChannelId || !discordChannelId || !guildId) {
        return res.status(400).json({ error: 'Missing required query parameters' });
    }
    const cacheKey = `user:${discordId}:guilds`;
    const guilds = await cacheGet(cacheKey);
    if (!guilds) {
        return res.status(503).json({ error: 'Redis unavailable or guilds not cached for user' });
    }
    if (!isGuildAdmin(guilds, guildId)) {
        return res.status(403).json({ error: 'Not authorized for this guild' });
    }
    const config = await getConfigManager().youtubeManager.getVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    res.json(config);
});

/**
 * @openapi
 * /youtube/{id}:
 *   get:
 *     summary: Get a YouTube config by primary key
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: YouTube config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoutubeVideoConfig'
 *       404:
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
    const config = await getConfigManager().youtubeManager.findByPkPlain(req.params.id);
    if (!config) return res.status(404).json({error: 'Not found'});
    res.json(config);
});

/**
 * @openapi
 * /youtube:
 *   post:
 *     summary: Add a new YouTube config
 *     tags: [YouTube]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/YoutubeVideoConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, async (req, res) => {
    const created = await getConfigManager().youtubeManager.addPlain(req.body);
    res.status(201).json(created);
});

/**
 * @openapi
 * /youtube:
 *   put:
 *     summary: Upsert (add or update) a YouTube config
 *     tags: [YouTube]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/YoutubeVideoConfig'
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/', jwtAuth, async (req, res) => {
    await getConfigManager().youtubeManager.setVideoChannel(req.body);
    res.json({success: true});
});

export default router;
