import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';

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
router.get('/channel', async (req, res) => {
    const {youtubeChannelId, discordChannelId} = req.query;
    if (!youtubeChannelId || !discordChannelId) return res.status(400).json({error: 'youtubeChannelId and discordChannelId required'});
    const config = await getConfigManager().youtubeManager.getVideoChannel({
        youtubeChannelId: String(youtubeChannelId),
        discordChannelId: String(discordChannelId)
    });
    if (!config) return res.status(404).json({error: 'Not found'});
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
router.post('/', async (req, res) => {
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
router.put('/', async (req, res) => {
    await getConfigManager().youtubeManager.setVideoChannel(req.body);
    res.json({success: true});
});

export default router;
