import {Router} from 'express';
import {getConfigManager, ForbiddenError, NotFoundError} from '@zeffuro/fakegaming-common';
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
    try {
        const config = await getConfigManager().youtubeManager.findByPkPlain(req.params.id);
        res.json(config);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: 'Not found' });
        }
        return res.status(500).json({ error: 'Failed to fetch YouTube configuration' });
    }
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
router.post('/', jwtAuth, requireGuildAdmin, async (req, res) => {
    try {
        // Use add instead of addPlain to match test mocks
        const created = await getConfigManager().youtubeManager.add(req.body);
        return res.status(201).json(created);
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return res.status(403).json({ error: error.message });
        }
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        const message = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : 'Failed to create YouTube configuration';
        return res.status(500).json({ error: message });
    }
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
        await getConfigManager().youtubeManager.upsert({ youtubeChannelId, discordChannelId, guildId, customMessage });

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
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });
    try {
        const config = await getConfigManager().youtubeManager.findByPkPlain(id);
        if (!config) return res.status(404).json({ error: 'YouTube config not found' });
        await getConfigManager().youtubeManager.remove({id});
        res.json({ success: true });
    } catch (err: any) {
        if (err?.name === 'ForbiddenError') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (err?.name === 'NotFoundError') {
            return res.status(404).json({ error: 'YouTube config not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
