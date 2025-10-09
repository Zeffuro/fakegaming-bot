import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBodyForModel, validateParams, validateQuery, validateBody } from '@zeffuro/fakegaming-common';
import { YoutubeVideoConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';

// Schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const channelSchema = z.object({
    youtubeChannelId: z.string().min(1),
    discordChannelId: z.string().min(1),
    guildId: z.string().min(1)
});

const router = createBaseRouter();

/**
 * @openapi
 * /youtube:
 *   get:
 *     summary: List all YouTube video configs
 *     tags: [YouTube]
 *     responses:
 *       200:
 *         description: List of YouTube video configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/YoutubeVideoConfig'
 */
router.get('/', async (_req, res) => {
    const videos = await getConfigManager().youtubeManager.getAllPlain();
    res.json(videos);
});

/**
 * @openapi
 * /youtube/channel:
 *   get:
 *     summary: Get a YouTube video config by channel
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
 *         description: YouTube video config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoutubeVideoConfig'
 *       400:
 *         description: Query validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get('/channel', jwtAuth, validateQuery(channelSchema), async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.query as z.infer<typeof channelSchema>;
    const config = await getConfigManager().youtubeManager.getVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    if (!config) return res.status(404).json({ error: 'YouTube video config not found' });
    res.json(config);
});

/**
 * @openapi
 * /youtube/{id}:
 *   get:
 *     summary: Get a YouTube video config by id
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: YouTube video config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoutubeVideoConfig'
 *       404:
 *         description: Not found
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const video = await getConfigManager().youtubeManager.findByPkPlain(Number(id));
    if (!video) return res.status(404).json({ error: 'YouTube video config not found' });
    res.json(video);
});

/**
 * @openapi
 * /youtube:
 *   post:
 *     summary: Create a new YouTube video config
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
router.post('/', jwtAuth, requireGuildAdmin, validateBodyForModel(YoutubeVideoConfig, 'create'), async (req, res, next) => {
    try {
        const created = await getConfigManager().youtubeManager.addPlain(req.body);
        res.status(201).json(created);
    } catch (err) {
        const { NotFoundError, ForbiddenError } = await import('@zeffuro/fakegaming-common');
        if (err instanceof NotFoundError) {
            return next(new ForbiddenError((err as Error).message));
        }
        return next(err);
    }
});

/**
 * @openapi
 * /youtube/channel:
 *   post:
 *     summary: Create or update a YouTube video config by channel
 *     tags: [YouTube]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               youtubeChannelId:
 *                 type: string
 *               discordChannelId:
 *                 type: string
 *               guildId:
 *                 type: string
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
 *                 created:
 *                   type: boolean
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 */
router.post('/channel', jwtAuth, validateBody(channelSchema), async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.body as z.infer<typeof channelSchema>;
    const { created } = await getConfigManager().youtubeManager.setVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    res.status(201).json({ success: true, created });
});

/**
 * @openapi
 * /youtube:
 *   put:
 *     summary: Upsert a YouTube video config by channel
 *     tags: [YouTube]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               youtubeChannelId:
 *                 type: string
 *               discordChannelId:
 *                 type: string
 *               guildId:
 *                 type: string
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
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — requires guild admin
 */
router.put('/', jwtAuth, requireGuildAdmin, validateBody(channelSchema), async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.body as z.infer<typeof channelSchema>;
    await getConfigManager().youtubeManager.setVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    res.status(200).json({ success: true });
});

/**
 * @openapi
 * /youtube/{id}:
 *   put:
 *     summary: Update a YouTube video config by id
 *     tags: [YouTube]
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
 *             $ref: '#/components/schemas/YoutubeVideoConfig'
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoutubeVideoConfig'
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put('/:id', jwtAuth, validateParams(idParamSchema), validateBodyForModel(YoutubeVideoConfig, 'update'), async (req, res) => {
    const { id } = req.params;
    const video = await getConfigManager().youtubeManager.findByPkPlain(Number(id));
    if (!video) return res.status(404).json({ error: 'YouTube video config not found' });
    await getConfigManager().youtubeManager.updatePlain(req.body, { id: Number(id) });
    const updated = await getConfigManager().youtubeManager.findByPkPlain(Number(id));
    res.json(updated);
});

/**
 * @openapi
 * /youtube/{id}:
 *   delete:
 *     summary: Delete a YouTube video config by id
 *     tags: [YouTube]
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
    const video = await getConfigManager().youtubeManager.findByPkPlain(numericId);
    if (!video) return res.status(404).json({ error: 'YouTube video config not found' });
    if (video.guildId) {
        const access = await checkUserGuildAccess(req, res, video.guildId);
        if (!access.authorized) return;
    }
    await getConfigManager().youtubeManager.removeByPk(numericId);
    res.json({ success: true });
});

export { router };
