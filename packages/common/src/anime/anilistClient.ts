import { getLogger } from '../utils/logger.js';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

export interface AniListTitle {
    id: number;
    type?: AniListMediaType | null;
    title: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
    };
    description?: string | null;
    synonyms?: string[] | null;
    siteUrl?: string | null;
    coverImage?: {
        large?: string | null;
        color?: string | null;
    } | null;
    bannerImage?: string | null;
    format?: string | null;
    status?: string | null;
    season?: string | null;
    seasonYear?: number | null;
    episodes?: number | null;
    duration?: number | null;
    chapters?: number | null;
    volumes?: number | null;
    countryOfOrigin?: string | null;
    averageScore?: number | null;
    meanScore?: number | null;
    popularity?: number | null;
    rankings?: AniListMediaRank[] | null;
    genres?: string[] | null;
    nextAiringEpisode?: AniListAiringEpisode | null;
}

export interface AniListMediaRank {
    rank: number;
    type?: 'RATED' | 'POPULAR' | string | null;
    allTime?: boolean | null;
    context?: string | null;
    year?: number | null;
    season?: AniListSeason | string | null;
    format?: string | null;
}

export interface AniListAiringEpisode {
    airingAt: number;
    episode: number;
    timeUntilAiring?: number | null;
}

export interface AniListAiringScheduleItem extends AniListAiringEpisode {
    mediaId: number;
    media?: AniListTitle | null;
}

export type AniListSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
export type AniListMediaType = 'ANIME' | 'MANGA';
export type AniListAnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
export type AniListMangaFormat = 'MANGA' | 'NOVEL' | 'ONE_SHOT';
export type AniListMediaFormat = AniListAnimeFormat | AniListMangaFormat;
export type AniListMediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
export type AniListSeasonScope = 'airing' | 'chart' | 'tv' | 'all';

export interface AniListSeasonFilter {
    scope?: AniListSeasonScope;
    formats?: AniListMediaFormat[];
    statuses?: AniListMediaStatus[];
}

export interface AniListPageInfo {
    total?: number | null;
    currentPage?: number | null;
    lastPage?: number | null;
    hasNextPage?: boolean | null;
    perPage?: number | null;
}

export interface AniListPageResult<T> {
    items: T[];
    pageInfo: AniListPageInfo;
}

interface GraphQlResponse<T> {
    data?: T;
    errors?: Array<{ message?: string; status?: number }>;
}

const titleFields = `
    id
    type
    title {
        romaji
        english
        native
    }
    description(asHtml: false)
    synonyms
    siteUrl
    coverImage {
        large
        color
    }
    bannerImage
    format
    status
    season
    seasonYear
    episodes
    duration
    chapters
    volumes
    countryOfOrigin
    averageScore
    meanScore
    popularity
    rankings {
        rank
        type
        allTime
        context
        year
        season
        format
    }
    genres
    nextAiringEpisode {
        airingAt
        episode
        timeUntilAiring
    }
`;

const searchMediaQuery = `
query SearchMedia($search: String!, $type: MediaType!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
        pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
        }
        media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) {
            ${titleFields}
        }
    }
}
`;

const mediaByIdQuery = `
query MediaById($id: Int!, $type: MediaType) {
    Media(id: $id, type: $type, isAdult: false) {
        ${titleFields}
    }
}
`;

const nextAiringQuery = `
query NextAiring($mediaIds: [Int]) {
    Page(page: 1, perPage: 50) {
        airingSchedules(mediaId_in: $mediaIds, notYetAired: true, sort: TIME) {
            mediaId
            airingAt
            episode
            timeUntilAiring
            media {
                ${titleFields}
            }
        }
    }
}
`;

const seasonAnimeQuery = `
query SeasonAnime($season: MediaSeason!, $seasonYear: Int!, $page: Int!, $perPage: Int!, $formats: [MediaFormat], $statuses: [MediaStatus]) {
    Page(page: $page, perPage: $perPage) {
        pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
            perPage
        }
        media(type: ANIME, isAdult: false, season: $season, seasonYear: $seasonYear, format_in: $formats, status_in: $statuses, sort: [POPULARITY_DESC, SCORE_DESC]) {
            ${titleFields}
        }
    }
}
`;

async function anilistRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    const body = await response.json() as GraphQlResponse<T>;
    if (!response.ok || body.errors?.length) {
        const retryAfter = response.headers.get('retry-after');
        const message = body.errors?.map((err) => err.message).filter(Boolean).join('; ') || response.statusText;
        throw new Error(`AniList request failed (${response.status})${retryAfter ? ` retry-after=${retryAfter}` : ''}: ${message}`);
    }
    if (!body.data) {
        throw new Error('AniList response did not include data.');
    }
    return body.data;
}

function normalizePage(value: number | undefined, fallback: number): number {
    return Number.isInteger(value) && value && value > 0 ? value : fallback;
}

function normalizePerPage(value: number | undefined, fallback: number): number {
    if (!Number.isInteger(value) || !value || value < 1) return fallback;
    return Math.min(value, 25);
}

function normalizeAniListPageInfo(pageInfo: AniListPageInfo | null | undefined, itemCount: number, page: number, perPage: number): AniListPageInfo {
    const currentPage = pageInfo?.currentPage ?? page;
    const hasNextPage = itemCount < perPage ? false : Boolean(pageInfo?.hasNextPage);
    const exactTotal = itemCount < perPage ? ((currentPage - 1) * perPage) + itemCount : pageInfo?.total;
    const totalLooksCapped = pageInfo?.total === 5000 && hasNextPage;
    return {
        total: totalLooksCapped ? null : exactTotal ?? null,
        currentPage,
        lastPage: totalLooksCapped ? null : pageInfo?.lastPage ?? null,
        hasNextPage,
        perPage: pageInfo?.perPage ?? perPage,
    };
}

export function getAniListSeasonScopeFilters(scope: AniListSeasonScope = 'airing'): Required<Pick<AniListSeasonFilter, 'formats' | 'statuses'>> {
    const chartFormats: AniListAnimeFormat[] = ['TV', 'TV_SHORT', 'ONA', 'OVA', 'MOVIE', 'SPECIAL'];
    if (scope === 'tv') {
        return {
            formats: ['TV', 'TV_SHORT'],
            statuses: ['RELEASING', 'NOT_YET_RELEASED'],
        };
    }
    if (scope === 'chart') {
        return {
            formats: chartFormats,
            statuses: ['RELEASING', 'NOT_YET_RELEASED', 'FINISHED'],
        };
    }
    if (scope === 'all') {
        return {
            formats: [...chartFormats, 'MUSIC'],
            statuses: ['RELEASING', 'NOT_YET_RELEASED', 'FINISHED'],
        };
    }
    return {
        formats: chartFormats,
        statuses: ['RELEASING', 'NOT_YET_RELEASED'],
    };
}

export function formatAniListSeasonScope(scope: AniListSeasonScope = 'airing'): string {
    if (scope === 'chart') return 'season chart';
    if (scope === 'tv') return 'TV only';
    if (scope === 'all') return 'all known formats';
    return 'airing/upcoming';
}

export async function searchAniListMediaPage(
    search: string,
    type: AniListMediaType = 'ANIME',
    page = 1,
    perPage = 10,
): Promise<AniListPageResult<AniListTitle>> {
    const query = search.trim();
    if (!query) return { items: [], pageInfo: { currentPage: 1, hasNextPage: false, perPage } };
    const log = getLogger({ name: 'anime:anilist' });
    const normalizedPage = normalizePage(page, 1);
    const normalizedPerPage = normalizePerPage(perPage, 10);
    try {
        const data = await anilistRequest<{ Page?: { media?: AniListTitle[] | null; pageInfo?: AniListPageInfo | null } }>(
            searchMediaQuery,
            { search: query, type, page: normalizedPage, perPage: normalizedPerPage },
        );
        return {
            items: data.Page?.media ?? [],
            pageInfo: normalizeAniListPageInfo(data.Page?.pageInfo, data.Page?.media?.length ?? 0, normalizedPage, normalizedPerPage),
        };
    } catch (err) {
        log.warn({ err, search: query, type }, 'AniList media search failed');
        return { items: [], pageInfo: { currentPage: normalizedPage, hasNextPage: false, perPage: normalizedPerPage } };
    }
}

export async function searchAniListMedia(search: string, type: AniListMediaType = 'ANIME'): Promise<AniListTitle[]> {
    return (await searchAniListMediaPage(search, type, 1, 10)).items;
}

export async function searchAniListAnimePage(search: string, page = 1, perPage = 10): Promise<AniListPageResult<AniListTitle>> {
    return searchAniListMediaPage(search, 'ANIME', page, perPage);
}

export async function searchAniListAnime(search: string): Promise<AniListTitle[]> {
    return searchAniListMedia(search, 'ANIME');
}

export async function searchAniListMangaPage(search: string, page = 1, perPage = 10): Promise<AniListPageResult<AniListTitle>> {
    return searchAniListMediaPage(search, 'MANGA', page, perPage);
}

export async function searchAniListManga(search: string): Promise<AniListTitle[]> {
    return searchAniListMedia(search, 'MANGA');
}

export async function getAniListMediaById(id: number, type?: AniListMediaType): Promise<AniListTitle | null> {
    const log = getLogger({ name: 'anime:anilist' });
    try {
        const data = await anilistRequest<{ Media?: AniListTitle | null }>(mediaByIdQuery, { id, type });
        return data.Media ?? null;
    } catch (err) {
        log.warn({ err, id, type }, 'AniList media lookup failed');
        return null;
    }
}

export async function getAniListAnimeById(id: number): Promise<AniListTitle | null> {
    return getAniListMediaById(id, 'ANIME');
}

export async function getAniListMangaById(id: number): Promise<AniListTitle | null> {
    return getAniListMediaById(id, 'MANGA');
}

export async function getAniListNextAiring(mediaIds: number[]): Promise<AniListAiringScheduleItem[]> {
    const ids = Array.from(new Set(mediaIds.filter(Number.isInteger)));
    if (!ids.length) return [];
    const log = getLogger({ name: 'anime:anilist' });
    try {
        const data = await anilistRequest<{ Page?: { airingSchedules?: AniListAiringScheduleItem[] | null } }>(nextAiringQuery, { mediaIds: ids });
        return data.Page?.airingSchedules ?? [];
    } catch (err) {
        log.warn({ err, mediaIds: ids }, 'AniList airing schedule lookup failed');
        return [];
    }
}

export async function getAniListSeasonAnimePage(
    season: AniListSeason,
    seasonYear: number,
    page = 1,
    perPage = 10,
    filter: AniListSeasonFilter = {},
): Promise<AniListPageResult<AniListTitle>> {
    const log = getLogger({ name: 'anime:anilist' });
    const normalizedPage = normalizePage(page, 1);
    const normalizedPerPage = normalizePerPage(perPage, 10);
    const scopeFilters = getAniListSeasonScopeFilters(filter.scope);
    const formats = filter.formats?.length ? filter.formats : scopeFilters.formats;
    const statuses = filter.statuses?.length ? filter.statuses : scopeFilters.statuses;
    try {
        const data = await anilistRequest<{ Page?: { media?: AniListTitle[] | null; pageInfo?: AniListPageInfo | null } }>(
            seasonAnimeQuery,
            { season, seasonYear, page: normalizedPage, perPage: normalizedPerPage, formats, statuses },
        );
        const items = data.Page?.media ?? [];
        return {
            items,
            pageInfo: normalizeAniListPageInfo(data.Page?.pageInfo, items.length, normalizedPage, normalizedPerPage),
        };
    } catch (err) {
        log.warn({ err, season, seasonYear, formats, statuses }, 'AniList season lookup failed');
        return { items: [], pageInfo: { currentPage: normalizedPage, hasNextPage: false, perPage: normalizedPerPage } };
    }
}

export async function getAniListSeasonAnime(season: AniListSeason, seasonYear: number): Promise<AniListTitle[]> {
    return (await getAniListSeasonAnimePage(season, seasonYear, 1, 25)).items;
}

export function getCurrentAniListSeason(now: Date = new Date()): { season: AniListSeason; year: number } {
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    if (month <= 3) return { season: 'WINTER', year };
    if (month <= 6) return { season: 'SPRING', year };
    if (month <= 9) return { season: 'SUMMER', year };
    return { season: 'FALL', year };
}

export function getNextAniListSeason(now: Date = new Date()): { season: AniListSeason; year: number } {
    const current = getCurrentAniListSeason(now);
    if (current.season === 'WINTER') return { season: 'SPRING', year: current.year };
    if (current.season === 'SPRING') return { season: 'SUMMER', year: current.year };
    if (current.season === 'SUMMER') return { season: 'FALL', year: current.year };
    return { season: 'WINTER', year: current.year + 1 };
}

export function getAniListDisplayTitle(title: Pick<AniListTitle, 'title'>): string {
    return title.title.english || title.title.romaji || title.title.native || 'Unknown title';
}

export function isAniListSubscribable(title: Pick<AniListTitle, 'status'>): boolean {
    return title.status !== 'FINISHED' && title.status !== 'CANCELLED';
}

export function mapAniListTitleToInput(title: AniListTitle) {
    return {
        anilistId: title.id,
        titleRomaji: title.title.romaji ?? null,
        titleEnglish: title.title.english ?? null,
        titleNative: title.title.native ?? null,
        description: title.description ?? null,
        siteUrl: title.siteUrl ?? null,
        coverImageUrl: title.coverImage?.large ?? null,
        bannerImageUrl: title.bannerImage ?? null,
        format: title.format ?? null,
        status: title.status ?? null,
        season: title.season ?? null,
        seasonYear: title.seasonYear ?? null,
        episodes: title.episodes ?? null,
        duration: title.duration ?? null,
        averageScore: title.averageScore ?? null,
        genres: title.genres ?? [],
        nextEpisode: title.nextAiringEpisode?.episode ?? null,
        nextAiringAt: title.nextAiringEpisode ? title.nextAiringEpisode.airingAt * 1000 : null,
    };
}
