import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';
import { getStringQueryParam, isGuildAdmin } from '../utils/requestHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { cacheGet } from '../../../common/src/cache';
import { CacheManager } from '../../../common/src/models/cache-manager';

const router = Router();

async function getUserGuilds(discordId: string): Promise<string[]> {
    const cacheKey = `user:${discordId}:guilds`;
    let guilds = await cacheGet(cacheKey);
    if (!guilds) {
        const cacheEntry = await CacheManager.findByPk(cacheKey);
        guilds = cacheEntry ? JSON.parse(cacheEntry.value) : [];
    }
    return guilds;
}

/**
 * @openapi
 * /twitch:
 *   get:
 *     summary: List all Twitch stream configs
 *     tags: [Twitch]
 *     responses:
 *       200:
 *         description: List of Twitch configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TwitchStreamConfig'
 */
router.get('/', async (req, res) => {
    const configs = await getConfigManager().twitchManager.getAllPlain();
    res.json(configs);
});

/**
 * @openapi
 * /twitch/exists:
 *   get:
 *     summary: Check if a Twitch stream exists for a Discord channel
 *     tags: [Twitch]
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Existence result
 */
router.get('/exists', jwtAuth, async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const twitchUsername = getStringQueryParam(req.query, 'twitchUsername');
    const discordChannelId = getStringQueryParam(req.query, 'discordChannelId');
    const guildId = getStringQueryParam(req.query, 'guildId');
    if (!twitchUsername || !discordChannelId || !guildId) {
        return res.status(400).json({ error: 'Missing required query parameters' });
    }
    const guilds = await getUserGuilds(discordId);
    if (!isGuildAdmin(guilds, guildId)) {
        return res.status(403).json({ error: 'Not authorized for this guild' });
    }
    const exists = await getConfigManager().twitchManager.streamExists(twitchUsername, discordChannelId, guildId);
    res.json({ exists });
});

/**
 * @openapi
 * /twitch/{id}:
 *   get:
 *     summary: Get a Twitch config by primary key
 *     tags: [Twitch]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Twitch config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TwitchStreamConfig'
 *       404:
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
    const config = await getConfigManager().twitchManager.findByPkPlain(req.params.id);
    if (!config) return res.status(404).json({error: 'Not found'});
    res.json(config);
});

/**
 * @openapi
 * /twitch:
 *   post:
 *     summary: Add a new Twitch config
 *     tags: [Twitch]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TwitchStreamConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/stream', jwtAuth, async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const { twitchUsername, discordChannelId, guildId, customMessage } = req.body;
    const guilds = await getUserGuilds(discordId);
    if (!guildId || !guilds.includes(guildId)) {
        return res.status(403).json({ error: 'Not authorized for this guild' });
    }
    // Add or update stream config
    await getConfigManager().twitchManager.upsert({ twitchUsername, discordChannelId, guildId, customMessage });
    console.log(`[AUDIT] User ${discordId} set Twitch stream config for guild ${guildId} at ${new Date().toISOString()}`);
    res.status(201).json({ success: true });
});

export default router;
