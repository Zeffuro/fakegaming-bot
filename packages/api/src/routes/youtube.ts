import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { validateBodyForModel, validateParams, validateQuery, validateBody } from '@zeffuro/fakegaming-common';
import { YoutubeVideoConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';
import { getLogger } from '@zeffuro/fakegaming-common';

// Schemas
const idParamSchema = z.object({ id: z.coerce.number().int() });
const channelSchema = z.object({
    youtubeChannelId: z.string().min(1),
    discordChannelId: z.string().min(1),
    guildId: z.string().min(1)
});

const router = createBaseRouter();
const log = getLogger({ name: 'api:routes:youtube' });

// Accept identifier via multiple keys; allow string or string[]; normalize to identifier
const resolveQuerySchema = z.object({
    identifier: z.union([z.string(), z.array(z.string())]).optional(),
    id: z.union([z.string(), z.array(z.string())]).optional(),
    channelId: z.union([z.string(), z.array(z.string())]).optional(),
    handle: z.union([z.string(), z.array(z.string())]).optional(),
    username: z.union([z.string(), z.array(z.string())]).optional(),
}).refine((q) => {
    const raw = q.identifier ?? q.id ?? q.channelId ?? q.handle ?? q.username;
    if (Array.isArray(raw)) return (raw[0]?.trim().length ?? 0) > 0;
    return typeof raw === 'string' && raw.trim().length > 0;
}, { message: 'identifier is required', path: ['identifier'] }).transform((q) => {
    const raw = q.identifier ?? q.id ?? q.channelId ?? q.handle ?? q.username;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return { identifier: (v ?? '').trim() };
});

function getYoutubeApiKey(): string | null {
    const key = process.env.YOUTUBE_API_KEY;
    return key && key.length > 0 ? key : null;
}

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
 * /youtube/resolve:
 *   get:
 *     summary: Resolve a YouTube channel identifier (handle/username/UC-Id) to a channelId
 *     tags: [YouTube]
 *     parameters:
 *       - in: query
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resolution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channelId:
 *                   type: string
 *                   nullable: true
 */
router.get('/resolve', validateQuery(resolveQuerySchema), async (req, res) => {
    const { identifier } = req.query as z.infer<typeof resolveQuerySchema>;
    if (/^UC[\w-]{22}$/.test(identifier)) {
        return res.json({ channelId: identifier });
    }
    const apiKey = getYoutubeApiKey();
    if (!apiKey) return res.json({ channelId: null });
    const base = 'https://www.googleapis.com/youtube/v3/channels?part=id';
    const isHandle = identifier.startsWith('@');
    const url = isHandle
        ? `${base}&forHandle=${encodeURIComponent(identifier.substring(1))}&key=${apiKey}`
        : `${base}&forUsername=${encodeURIComponent(identifier)}&key=${apiKey}`;
    try {
        const r = await fetch(url);
        if (!r.ok) return res.json({ channelId: null });
        const data = await r.json();
        const id = data?.items?.[0]?.id ?? null;
        return res.json({ channelId: id ?? null });
    } catch (err) {
        log.error({ err, identifier }, 'Error resolving YouTube channel');
        return res.json({ channelId: null });
    }
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/channel', jwtAuth, validateQuery(channelSchema), async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.query as z.infer<typeof channelSchema>;
    const config = await getConfigManager().youtubeManager.getVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    if (!config) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'YouTube video config not found' } });
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
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const video = await getConfigManager().youtubeManager.findByPkPlain(Number(id));
    if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'YouTube video config not found' } });
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
 *     description: |
 *       Creates a YouTube video configuration for a guild+channel pair.
 *       Allowed fields in request body:
 *       - youtubeChannelId (string, required)
 *       - discordChannelId (string, required)
 *       - guildId (string, required)
 *       - customMessage (string, optional)
 *       - cooldownMinutes (integer >= 0 or null, optional)
 *       - quietHoursStart (HH:mm or null, optional)
 *       - quietHoursEnd (HH:mm or null, optional)
 *
 *       Read-only fields (ignored if provided): lastVideoId, lastNotifiedAt.
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *     description: |
 *       Upserts a YouTube config based on channel identity. Allowed body fields:
 *       - youtubeChannelId (string, required)
 *       - discordChannelId (string, required)
 *       - guildId (string, required)
 *       Other fields like cooldownMinutes/quietHours should be updated via PUT /youtube/{id}.
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     description: |
 *       Updates a YouTube configuration by id. Allowed fields in request body:
 *       - youtubeChannelId (string)
 *       - discordChannelId (string)
 *       - guildId (string)
 *       - customMessage (string)
 *       - cooldownMinutes (integer >= 0 or null)
 *       - quietHoursStart (HH:mm or null)
 *       - quietHoursEnd (HH:mm or null)
 *
 *       Read-only fields: lastVideoId, lastNotifiedAt.
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', jwtAuth, validateParams(idParamSchema), validateBodyForModel(YoutubeVideoConfig, 'update'), async (req, res) => {
    const { id } = req.params;
    const video = await getConfigManager().youtubeManager.findByPkPlain(Number(id));
    if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'YouTube video config not found' } });
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
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);
    const video = await getConfigManager().youtubeManager.findByPkPlain(numericId);
    if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'YouTube video config not found' } });
    if (video.guildId) {
        const access = await checkUserGuildAccess(req, res, video.guildId);
        if (!access.authorized) return;
    }
    await getConfigManager().youtubeManager.removeByPk(numericId);
    res.json({ success: true });
});


export { router };
