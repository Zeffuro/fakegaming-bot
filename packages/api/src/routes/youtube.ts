import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {jwtAuth} from '../middleware/auth.js';
import {getStringQueryParam} from '../utils/requestHelpers.js';
import {requireGuildAdmin, checkUserGuildAccess} from '../utils/authHelpers.js';
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
    try {
        const configs = await getConfigManager().youtubeManager.getAllPlain();
        res.json(configs);
    } catch (error) {
        console.error('[YouTube API] Error fetching all configs:', error);
        res.status(500).json({ error: 'Failed to fetch YouTube configurations' });
    }
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
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
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
router.get('/channel', jwtAuth, requireGuildAdmin, async (req, res) => {
    const youtubeChannelId = getStringQueryParam(req.query, 'youtubeChannelId');
    const discordChannelId = getStringQueryParam(req.query, 'discordChannelId');
    const guildId = getStringQueryParam(req.query, 'guildId');

    if (!youtubeChannelId || !discordChannelId || !guildId) {
        return res.status(400).json({ error: 'Missing required query parameters' });
    }

    try {
        // Permission check is now handled by the requireGuildAdmin middleware
        const config = await getConfigManager().youtubeManager.getVideoChannel({ youtubeChannelId, discordChannelId, guildId });
        res.json(config);
    } catch (error) {
        console.error('[YouTube API] Error fetching channel config:', error);
        res.status(500).json({ error: 'Failed to fetch YouTube channel configuration' });
    }
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

/**
 * @openapi
 * /youtube/channel:
 *   post:
 *     summary: Add a new YouTube channel config
 *     tags: [YouTube]
 *     security:
 *       - bearerAuth: []
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
router.post('/channel', jwtAuth, requireGuildAdmin, async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId, customMessage } = req.body;

    if (!youtubeChannelId || !discordChannelId || !guildId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Permission check is now handled by the requireGuildAdmin middleware

        // Add or update channel config
        await getConfigManager().youtubeManager.upsert({ youtubeChannelId, discordChannelId, guildId, customMessage });

        // Log the action
        const { discordId } = (req as AuthenticatedRequest).user;
        console.log(`[AUDIT] User ${discordId} set YouTube channel config for guild ${guildId} at ${new Date().toISOString()}`);

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('[YouTube API] Error creating/updating channel config:', error);
        res.status(500).json({ error: 'Failed to save YouTube channel configuration' });
    }
});

/**
 * @openapi
 * /youtube/{id}:
 *   delete:
 *     summary: Delete a YouTube channel configuration
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *       404:
 *         description: Not found
 */
router.delete('/:id', jwtAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const config = await getConfigManager().youtubeManager.findByPkPlain(id);

        if (!config) {
            return res.status(404).json({ error: 'YouTube configuration not found' });
        }

        // Check guild admin permission using the guildId from the config
        const authResult = await checkUserGuildAccess(req, res, (config as any).guildId);
        if (!authResult.authorized) {
            // Response already sent by checkUserGuildAccess
            return;
        }

        // Delete the configuration
        await getConfigManager().youtubeManager.remove({ id });

        // Log the action
        const { discordId } = (req as AuthenticatedRequest).user;
        console.log(`[AUDIT] User ${discordId} deleted YouTube config ID ${id} at ${new Date().toISOString()}`);

        res.json({ success: true });
    } catch (error) {
        console.error('[YouTube API] Error deleting config:', error);
        res.status(500).json({ error: 'Failed to delete YouTube configuration' });
    }
});

export default router;
