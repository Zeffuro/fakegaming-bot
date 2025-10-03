import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';
import {getStringQueryParam} from '../utils/requestHelpers.js';
import {requireGuildAdmin} from '../utils/authHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();

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
    try {
        const configs = await getConfigManager().twitchManager.getAllPlain();
        res.json(configs);
    } catch (error) {
        console.error('[Twitch API] Error fetching all configs:', error);
        res.status(500).json({ error: 'Failed to fetch Twitch configurations' });
    }
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
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Existence result
 */
router.get('/exists', jwtAuth, requireGuildAdmin, async (req: any, res: any) => {
    const twitchUsername = getStringQueryParam(req.query, 'twitchUsername');
    const discordChannelId = getStringQueryParam(req.query, 'discordChannelId');
    const guildId = getStringQueryParam(req.query, 'guildId');

    if (!twitchUsername || !discordChannelId || !guildId) {
        return res.status(400).json({ error: 'Missing required query parameters' });
    }

    try {
        // Permission check is now handled by the requireGuildAdmin middleware
        const exists = await getConfigManager().twitchManager.streamExists(twitchUsername, discordChannelId, guildId);
        res.json({ exists });
    } catch (error) {
        console.error('[Twitch API] Error checking if stream exists:', error);
        res.status(500).json({ error: 'Failed to check if stream exists' });
    }
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
    try {
        const config = await getConfigManager().twitchManager.findByPkPlain(req.params.id);
        if (!config) return res.status(404).json({error: 'Not found'});
        res.json(config);
    } catch (error) {
        console.error('[Twitch API] Error fetching config by ID:', error);
        res.status(500).json({ error: 'Failed to fetch Twitch configuration' });
    }
});

/**
 * @openapi
 * /twitch:
 *   post:
 *     summary: Add a new Twitch stream config
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
router.post('/', jwtAuth, requireGuildAdmin, async (req, res) => {
    const { twitchUsername, discordChannelId, guildId, customMessage } = req.body;

    if (!twitchUsername || !discordChannelId || !guildId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Permission check is now handled by the requireGuildAdmin middleware

        // Add or update stream config
        await getConfigManager().twitchManager.upsert({ twitchUsername, discordChannelId, guildId, customMessage });

        // Log the action
        const { discordId } = (req as AuthenticatedRequest).user;
        console.log(`[AUDIT] User ${discordId} set Twitch stream config for guild ${guildId} at ${new Date().toISOString()}`);

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('[Twitch API] Error creating/updating stream config:', error);
        res.status(500).json({ error: 'Failed to save Twitch configuration' });
    }
});

export default router;
