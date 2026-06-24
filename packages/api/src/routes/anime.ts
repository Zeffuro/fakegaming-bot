import { z } from 'zod';
import {
    getAniListAnimeById,
    getAniListSeasonAnimePage,
    getCurrentAniListSeason,
    getNextAniListSeason,
    formatAniListSeasonScope,
    isAniListSubscribable,
    mapAniListTitleToInput,
    searchAniListAnime,
    searchAniListMediaPage,
    type AniListMediaType,
    type AniListPageInfo,
    type AniListSeason,
    type AniListSeasonScope,
    type AniListTitle,
} from '@zeffuro/fakegaming-common/anime';
import type { AnimeSubscriptionConfig } from '@zeffuro/fakegaming-common/models';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { defaultCacheManager, validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { animeSubscribeRequestSchema, pausedStateRequestSchema, userAnimeSubscribeRequestSchema } from '@zeffuro/fakegaming-common/api';
import type { CreationAttributes } from 'sequelize';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = createBaseRouter();
const ANIME_SEASON_CACHE_TTL_MS = 30 * 60 * 1000;

interface AnimeSeasonResponse {
    season: AniListSeason;
    year: number;
    scope: AniListSeasonScope;
    scopeLabel: string;
    results: AniListTitle[];
    pageInfo: AniListPageInfo;
}

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const searchQuerySchema = z.object({
    q: z.string().min(1),
    type: z.enum(['anime', 'manga']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(25).optional(),
});
const seasonQuerySchema = z.object({
    season: z.enum(['current', 'next', 'WINTER', 'SPRING', 'SUMMER', 'FALL']),
    scope: z.enum(['airing', 'chart', 'tv', 'all']).optional(),
    year: z.coerce.number().int().min(1940).max(2100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(25).optional(),
});
const listQuerySchema = z.object({
    guildId: z.string().min(1).optional(),
});

function resolveSeason(value: z.infer<typeof seasonQuerySchema>): { season: AniListSeason; year: number } {
    if (value.season === 'current') return getCurrentAniListSeason();
    if (value.season === 'next') return getNextAniListSeason();
    return { season: value.season, year: value.year ?? new Date().getUTCFullYear() };
}

function parseAniListMediaType(type: 'anime' | 'manga' | undefined): AniListMediaType {
    return type === 'manga' ? 'MANGA' : 'ANIME';
}

function getAnimeSeasonCacheKey(args: {
    season: AniListSeason;
    year: number;
    scope: AniListSeasonScope;
    page: number;
    perPage: number;
}): string {
    return `anime:season:${args.season}:${args.year}:${args.scope}:page:${args.page}:perPage:${args.perPage}`;
}

async function resolveAnime(args: { anilistId?: number; title?: string }): Promise<AniListTitle | null> {
    if (args.anilistId) {
        const anime = await getAniListAnimeById(args.anilistId);
        if (!anime) return null;
        await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
        return anime;
    }
    const result = (await searchAniListAnime(args.title ?? ''))[0] ?? null;
    if (!result) return null;
    await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(result));
    return result;
}

async function serializeSubscription(sub: CreationAttributes<AnimeSubscriptionConfig>) {
    const title = await getConfigManager().animeManager.titles.getOnePlain({ anilistId: sub.anilistId });
    return {
        ...sub,
        paused: Boolean(sub.paused),
        animeTitle: title?.titleEnglish ?? title?.titleRomaji ?? title?.titleNative ?? `AniList #${sub.anilistId}`,
        discordChannelId: sub.channelId ?? '',
        status: title?.status ?? null,
        format: title?.format ?? null,
        episodes: title?.episodes ?? null,
        averageScore: title?.averageScore ?? null,
        nextEpisode: title?.nextEpisode ?? null,
        nextAiringAt: title?.nextAiringAt ?? null,
        title,
    };
}

async function recordAnimeSubscriptionPausedStatus(
    subscription: CreationAttributes<AnimeSubscriptionConfig>,
    paused: boolean
): Promise<void> {
    const manager = getConfigManager().integrationHealthManager;
    try {
        await manager.recordStatus({
            provider: 'anime',
            configId: subscription.id ?? `${subscription.targetType}:${subscription.anilistId}:${subscription.channelId ?? subscription.userId ?? 'unknown'}`,
            guildId: subscription.guildId ?? null,
            channelId: subscription.channelId ?? null,
            status: paused ? 'paused' : 'unknown',
            metadata: {
                anilistId: subscription.anilistId,
                targetType: subscription.targetType,
                paused,
            },
        });
    } catch {
        // Health status should not block a successful configuration update.
    }
}

async function ensureAnimeSubscriptionAccess(
    req: AuthenticatedRequest,
    res: Parameters<typeof checkUserGuildAccess>[1],
    subscription: CreationAttributes<AnimeSubscriptionConfig>
): Promise<boolean> {
    if (subscription.guildId) {
        const access = await checkUserGuildAccess(req, res, subscription.guildId);
        return access.authorized;
    }

    if (subscription.userId !== req.user.discordId) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this anime subscription' } });
        return false;
    }

    return true;
}

/**
 * @openapi
 * /anime:
 *   get:
 *     summary: List anime channel subscriptions
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', jwtAuth, validateQuery(listQuerySchema), async (req, res) => {
    const { guildId } = req.query as z.infer<typeof listQuerySchema>;
    const subscriptions = guildId
        ? await getConfigManager().animeManager.subscriptions.getGuildChannelSubscriptions(guildId)
        : await getConfigManager().animeManager.subscriptions.getUserSubscriptions((req as AuthenticatedRequest).user.discordId);
    if (guildId) {
        const access = await checkUserGuildAccess(req, res, guildId);
        if (!access.authorized) return;
    }
    res.json(await Promise.all(subscriptions.map(serializeSubscription)));
});

/**
 * @openapi
 * /anime/search:
 *   get:
 *     summary: Search AniList media
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [anime, manga]
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: perPage
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Search results with page info
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/search', jwtAuth, validateQuery(searchQuerySchema), async (req, res) => {
    const { q, type, page = 1, perPage = 10 } = req.query as unknown as z.infer<typeof searchQuerySchema>;
    const mediaType = parseAniListMediaType(type);
    const { items: results, pageInfo } = await searchAniListMediaPage(q, mediaType, page, perPage);
    for (const media of results.slice(0, 10)) {
        await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(media));
    }
    res.json({ type: mediaType, results, pageInfo });
});

/**
 * @openapi
 * /anime/season:
 *   get:
 *     summary: List AniList titles for a season
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: season
 *         required: true
 *         schema:
 *           type: string
 *           enum: [current, next, WINTER, SPRING, SUMMER, FALL]
 *       - in: query
 *         name: scope
 *         required: false
 *         schema:
 *           type: string
 *           enum: [airing, chart, tv, all]
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1940
 *           maximum: 2100
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: perPage
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Seasonal AniList titles with page info
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/season', jwtAuth, validateQuery(seasonQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof seasonQuerySchema>;
    const resolved = resolveSeason(query);
    const { page = 1, perPage = 10, scope = 'airing' } = query;
    const normalizedScope = scope as AniListSeasonScope;
    const cacheKey = getAnimeSeasonCacheKey({
        season: resolved.season,
        year: resolved.year,
        scope: normalizedScope,
        page,
        perPage,
    });

    const cached = await defaultCacheManager.get<AnimeSeasonResponse>(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    const { items: results, pageInfo } = await getAniListSeasonAnimePage(resolved.season, resolved.year, page, perPage, { scope: normalizedScope });
    for (const anime of results) {
        await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
    }
    const payload: AnimeSeasonResponse = {
        ...resolved,
        scope: normalizedScope,
        scopeLabel: formatAniListSeasonScope(normalizedScope),
        results,
        pageInfo,
    };
    await defaultCacheManager.set(cacheKey, payload, ANIME_SEASON_CACHE_TTL_MS);
    return res.json(payload);
});

/**
 * @openapi
 * /anime/me:
 *   post:
 *     summary: Subscribe the authenticated user to anime episode DM reminders
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserAnimeSubscribeRequest'
 *     responses:
 *       200:
 *         description: Existing personal subscription updated
 *       201:
 *         description: Personal subscription created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/me', jwtAuth, validateBody(userAnimeSubscribeRequestSchema), async (req, res) => {
    const body = req.body as z.infer<typeof userAnimeSubscribeRequestSchema>;
    const anime = await resolveAnime(body);
    if (!anime) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anime not found' } });
    }
    if (!isAniListSubscribable(anime)) {
        return res.status(400).json({
            error: {
                code: 'ANIME_NOT_SUBSCRIBABLE',
                message: `${anime.title.english ?? anime.title.romaji ?? anime.title.native ?? `AniList #${anime.id}`} is ${anime.status?.toLowerCase() ?? 'not subscribable'}.`,
            },
        });
    }

    const userId = (req as AuthenticatedRequest).user.discordId;
    const created = await getConfigManager().animeManager.subscriptions.subscribeUser({
        anilistId: anime.id,
        userId,
        reminderMinutes: body.reminderMinutes ?? 30,
    });
    await recordAuditEvent(req, {
        action: created ? 'animeSubscription.create' : 'animeSubscription.update',
        targetType: 'animeSubscription',
        targetId: anime.id,
        guildId: null,
        metadata: {
            anilistId: anime.id,
            targetType: 'dm',
            reminderMinutes: body.reminderMinutes ?? 30,
        },
    });
    res.status(created ? 201 : 200).json({ success: true, created, anilistId: anime.id });
});

/**
 * @openapi
 * /anime:
 *   post:
 *     summary: Subscribe a guild channel to anime episode notifications
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnimeSubscribeRequest'
 *     responses:
 *       200:
 *         description: Existing subscription updated
 *       201:
 *         description: Subscription created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/', jwtAuth, validateBody(animeSubscribeRequestSchema), requireGuildAdmin, async (req, res) => {
    const body = req.body as z.infer<typeof animeSubscribeRequestSchema>;
    const anime = await resolveAnime(body);
    if (!anime) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Anime not found' } });
    }
    if (!isAniListSubscribable(anime)) {
        return res.status(400).json({
            error: {
                code: 'ANIME_NOT_SUBSCRIBABLE',
                message: `${anime.title.english ?? anime.title.romaji ?? anime.title.native ?? `AniList #${anime.id}`} is ${anime.status?.toLowerCase() ?? 'not subscribable'}.`,
            },
        });
    }
    const created = await getConfigManager().animeManager.subscriptions.subscribeChannel({
        anilistId: anime.id,
        guildId: body.guildId,
        channelId: body.channelId,
        reminderMinutes: body.reminderMinutes ?? 30,
    });
    await recordAuditEvent(req, {
        action: created ? 'animeSubscription.create' : 'animeSubscription.update',
        targetType: 'animeSubscription',
        targetId: anime.id,
        guildId: body.guildId,
        metadata: {
            channelId: body.channelId,
            reminderMinutes: body.reminderMinutes ?? 30,
        },
    });
    res.status(created ? 201 : 200).json({ success: true, created, anilistId: anime.id });
});

/**
 * @openapi
 * /anime/{id}:
 *   patch:
 *     summary: Pause or resume an anime subscription
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PausedStateRequest'
 *     responses:
 *       200:
 *         description: Updated anime subscription
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', jwtAuth, validateParams(idParamSchema), validateBody(pausedStateRequestSchema), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof pausedStateRequestSchema>;
    const manager = getConfigManager().animeManager.subscriptions;
    const subscription = await manager.findByPkPlain(id);
    const hasAccess = await ensureAnimeSubscriptionAccess(req as AuthenticatedRequest, res, subscription);
    if (!hasAccess) return;

    await manager.setPaused(id, body.paused);
    const updated = await manager.findByPkPlain(id);
    await recordAnimeSubscriptionPausedStatus(updated, body.paused);
    await recordAuditEvent(req, {
        action: body.paused ? 'animeSubscription.pause' : 'animeSubscription.resume',
        targetType: 'animeSubscription',
        targetId: id,
        guildId: updated.guildId ?? null,
        metadata: {
            anilistId: updated.anilistId,
            channelId: updated.channelId,
            targetType: updated.targetType,
            paused: body.paused,
        },
    });
    res.json(await serializeSubscription(updated));
});

/**
 * @openapi
 * /anime/{id}:
 *   delete:
 *     summary: Delete an anime subscription
 *     tags: [Anime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Subscription deleted
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const subscription = await getConfigManager().animeManager.subscriptions.findByPkPlain(Number(id));
    const hasAccess = await ensureAnimeSubscriptionAccess(req as AuthenticatedRequest, res, subscription);
    if (!hasAccess) return;
    await getConfigManager().animeManager.subscriptions.removeByPk(Number(id));
    await recordAuditEvent(req, {
        action: 'animeSubscription.delete',
        targetType: 'animeSubscription',
        targetId: id,
        guildId: subscription.guildId ?? null,
        metadata: {
            anilistId: subscription.anilistId,
            channelId: subscription.channelId,
        },
    });
    res.json({ success: true });
});

export { router };
