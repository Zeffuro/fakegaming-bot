import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common';

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
router.get('/exists', async (req, res) => {
    const {username, channelId} = req.query;
    if (!username || !channelId) return res.status(400).json({error: 'username and channelId required'});
    const exists = await getConfigManager().twitchManager.streamExists(String(username), String(channelId));
    res.json({exists});
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
router.post('/', async (req, res) => {
    const created = await getConfigManager().twitchManager.addPlain(req.body);
    res.status(201).json(created);
});

export default router;
