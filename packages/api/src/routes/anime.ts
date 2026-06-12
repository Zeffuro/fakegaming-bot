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
import { animeSubscribeRequestSchema } from '@zeffuro/fakegaming-common/api';
import type { CreationAttributes } from 'sequelize';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';

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

router.get('/search', jwtAuth, validateQuery(searchQuerySchema), async (req, res) => {
    const { q, type, page = 1, perPage = 10 } = req.query as unknown as z.infer<typeof searchQuerySchema>;
    const mediaType = parseAniListMediaType(type);
    const { items: results, pageInfo } = await searchAniListMediaPage(q, mediaType, page, perPage);
    for (const media of results.slice(0, 10)) {
        await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(media));
    }
    res.json({ type: mediaType, results, pageInfo });
});

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
    res.status(created ? 201 : 200).json({ success: true, created, anilistId: anime.id });
});

router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { id } = req.params;
    const subscription = await getConfigManager().animeManager.subscriptions.findByPkPlain(Number(id));
    if (subscription.guildId) {
        const access = await checkUserGuildAccess(req, res, subscription.guildId);
        if (!access.authorized) return;
    } else if (subscription.userId !== (req as AuthenticatedRequest).user.discordId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this anime subscription' } });
    }
    await getConfigManager().animeManager.subscriptions.removeByPk(Number(id));
    res.json({ success: true });
});

export { router };
