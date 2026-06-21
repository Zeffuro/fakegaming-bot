import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { defaultCacheManager, validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { youtubeChannelRequestSchema, youtubeCreateRequestSchema, youtubeUpdateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth, jwtOrService } from '../middleware/auth.js';
import {
    requireGuildAdmin,
    checkUserGuildAccess,
} from '../utils/authHelpers.js';
import { getLogger } from '@zeffuro/fakegaming-common';
import { fetchYouTubeChannelPageMetadata } from '../utils/youtubePublic.js';
import { requireDashboardAdminOrService } from '../utils/dashboardAdmin.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    channelAuditMetadata,
    deleteGuildScopedRecord,
    loadGuildScopedRecords,
    sendGuildScopedRecordById,
    sendGuildScopedRecords,
    updateGuildScopedRecord,
    updatedChannelAuditMetadata,
} from '../utils/guildScopedRouteHelpers.js';
import { numericIdParamSchema, optionalGuildListQuerySchema } from './sharedSchemas.js';

// Schemas
const metadataQuerySchema = z.object({
    channelId: z.string().trim().min(1),
});

const router = createBaseRouter();
const log = getLogger({ name: 'api:routes:youtube' });
const YOUTUBE_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

interface YouTubeMetadataResponse {
    channelId: string;
    title: string | null;
    url: string | null;
    latestVideoId: string | null;
}

function getYouTubeMetadataCacheKey(channelId: string): string {
    return `youtube:metadata:${channelId}`;
}

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

function decodeXmlText(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractXmlText(xml: string, tagName: string): string | null {
    const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    return match?.[1] ? decodeXmlText(match[1].trim()) : null;
}

function extractLatestVideoId(xml: string): string | null {
    return extractXmlText(xml, 'yt:videoId');
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
router.get('/', validateQuery(optionalGuildListQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof optionalGuildListQuerySchema>;
    const videos = await loadGuildScopedRecords(getConfigManager().youtubeManager, guildId);
    await sendGuildScopedRecords(req, res, videos, guildId);
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
router.get('/resolve', jwtOrService, requireDashboardAdminOrService, validateQuery(resolveQuerySchema), async (req, res) => {
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
 * /youtube/metadata:
 *   get:
 *     summary: Resolve public YouTube channel metadata from the channel Atom feed
 *     tags: [YouTube]
 *     parameters:
 *       - in: query
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public channel metadata when available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channelId:
 *                   type: string
 *                 title:
 *                   type: string
 *                   nullable: true
 *                 url:
 *                   type: string
 *                   nullable: true
 *                 latestVideoId:
 *                   type: string
 *                   nullable: true
 */
async function resolveYouTubeMetadata(channelId: string): Promise<YouTubeMetadataResponse> {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    let feedTitle: string | null = null;
    let feedUrlValue: string | null = null;
    let feedLatestVideoId: string | null = null;

    try {
        const r = await fetch(feedUrl, {
            headers: { 'user-agent': 'fakegaming-bot/1.0 (+https://github.com/)' },
        });
        if (r.ok) {
            const xml = await r.text();
            feedTitle = extractXmlText(xml, 'name') ?? extractXmlText(xml, 'title');
            feedUrlValue = extractXmlText(xml, 'uri');
            feedLatestVideoId = extractLatestVideoId(xml);
        }
    } catch (err) {
        log.debug({ err, channelId }, 'Error resolving YouTube channel metadata from feed');
    }

    try {
        const pageMetadata = feedTitle ? { title: null, url: null, latestVideoId: null } : await fetchYouTubeChannelPageMetadata(channelId);
        return {
            channelId,
            title: feedTitle ?? pageMetadata.title,
            url: feedUrlValue ?? pageMetadata.url ?? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`,
            latestVideoId: feedLatestVideoId ?? pageMetadata.latestVideoId,
        };
    } catch (err) {
        log.warn({ err, channelId }, 'Error resolving YouTube channel metadata from public page');
        return {
            channelId,
            title: feedTitle,
            url: feedUrlValue,
            latestVideoId: feedLatestVideoId,
        };
    }
}

router.get('/metadata', validateQuery(metadataQuerySchema), async (req, res) => {
    const { channelId } = req.query as z.infer<typeof metadataQuerySchema>;
    const cacheKey = getYouTubeMetadataCacheKey(channelId);
    const cached = await defaultCacheManager.get<YouTubeMetadataResponse>(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    const metadata = await resolveYouTubeMetadata(channelId);
    await defaultCacheManager.set(cacheKey, metadata, YOUTUBE_METADATA_CACHE_TTL_MS);
    return res.json(metadata);
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
router.get('/channel', jwtAuth, validateQuery(youtubeChannelRequestSchema), async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.query as z.infer<typeof youtubeChannelRequestSchema>;
    const access = await checkUserGuildAccess(req, res, guildId);
    if (!access.authorized) return;
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
router.get('/:id', validateParams(numericIdParamSchema), async (req, res) => {
    const manager = getConfigManager().youtubeManager;
    await sendGuildScopedRecordById(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        notFoundMessage: 'YouTube video config not found',
    });
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
 *             $ref: '#/components/schemas/YoutubeCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoutubeVideoConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', jwtAuth, validateBody(youtubeCreateRequestSchema), requireGuildAdmin, async (req, res, next) => {
    try {
        const created = await getConfigManager().youtubeManager.addPlain(req.body);
        await recordAuditEvent(req, {
            action: 'youtube.create',
            targetType: 'youtubeConfig',
            targetId: created.id,
            guildId: created.guildId ?? null,
            metadata: channelAuditMetadata(created, {
                youtubeChannelId: created.youtubeChannelId,
            }),
        });
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
 *             $ref: '#/components/schemas/YoutubeChannelRequest'
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
router.post('/channel', jwtAuth, validateBody(youtubeChannelRequestSchema), requireGuildAdmin, async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.body as z.infer<typeof youtubeChannelRequestSchema>;
    const { created } = await getConfigManager().youtubeManager.setVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    await recordAuditEvent(req, {
        action: created ? 'youtube.create' : 'youtube.update',
        targetType: 'youtubeConfig',
        targetId: youtubeChannelId,
        guildId,
        metadata: channelAuditMetadata({ discordChannelId }),
    });
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
 *             $ref: '#/components/schemas/YoutubeChannelRequest'
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
router.put('/', jwtAuth, validateBody(youtubeChannelRequestSchema), requireGuildAdmin, async (req, res) => {
    const { youtubeChannelId, discordChannelId, guildId } = req.body as z.infer<typeof youtubeChannelRequestSchema>;
    await getConfigManager().youtubeManager.setVideoChannel({ youtubeChannelId, discordChannelId, guildId });
    await recordAuditEvent(req, {
        action: 'youtube.update',
        targetType: 'youtubeConfig',
        targetId: youtubeChannelId,
        guildId,
        metadata: channelAuditMetadata({ discordChannelId }),
    });
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
 *             $ref: '#/components/schemas/YoutubeUpdateRequest'
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
router.put('/:id', jwtAuth, validateParams(numericIdParamSchema), validateBody(youtubeUpdateRequestSchema), async (req, res) => {
    const body = req.body as z.output<typeof youtubeUpdateRequestSchema>;
    const manager = getConfigManager().youtubeManager;
    await updateGuildScopedRecord(req, res, Number(req.params.id), body, {
        findByPk: id => manager.findByPkPlain(id),
        update: (id, data) => manager.updatePlain(data, { id }),
        notFoundMessage: 'YouTube video config not found',
        auditAction: 'youtube.update',
        auditTargetType: 'youtubeConfig',
        auditMetadata: (updated, previous) => updatedChannelAuditMetadata(updated, previous, {
            youtubeChannelId: updated.youtubeChannelId ?? previous.youtubeChannelId,
        }),
    });
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
router.delete('/:id', jwtAuth, validateParams(numericIdParamSchema), async (req, res) => {
    const manager = getConfigManager().youtubeManager;
    await deleteGuildScopedRecord(req, res, Number(req.params.id), {
        findByPk: id => manager.findByPkPlain(id),
        removeByPk: id => manager.removeByPk(id),
        notFoundMessage: 'YouTube video config not found',
        auditAction: 'youtube.delete',
        auditTargetType: 'youtubeConfig',
        auditMetadata: video => channelAuditMetadata(video, {
            youtubeChannelId: video.youtubeChannelId,
        }),
    });
});


export { router };
