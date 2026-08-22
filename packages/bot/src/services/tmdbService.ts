import {
    DEFAULT_OUTPUT_LOCALE,
    getOutputLocaleMetadata,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_REQUEST_TIMEOUT_MS = 8_000;

export type TmdbMediaType = 'movie' | 'tv';
export type TmdbSearchType = TmdbMediaType | 'all';

export interface TmdbMedia {
    id: number;
    type: TmdbMediaType;
    title: string;
    originalTitle: string | null;
    overview: string | null;
    releaseDate: string | null;
    originalLanguage: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    voteAverage: number | null;
    voteCount: number | null;
    popularity: number | null;
    runtimeMinutes: number | null;
    seasonCount: number | null;
    episodeCount: number | null;
    status: string | null;
    genres: string[];
}

export class TmdbConfigurationError extends Error {
    constructor() {
        super('TMDB_API_TOKEN is not configured');
        this.name = 'TmdbConfigurationError';
    }
}

export class TmdbRequestError extends Error {
    constructor(readonly status: number | null) {
        super(status === null ? 'TMDB request failed' : `TMDB request failed (${status})`);
        this.name = 'TmdbRequestError';
    }
}

export class TmdbAuthenticationError extends TmdbRequestError {
    constructor(status: number) {
        super(status);
        this.name = 'TmdbAuthenticationError';
    }
}

interface TmdbSearchResponse {
    results?: unknown;
}

interface TmdbCredential {
    kind: 'api-key' | 'bearer';
    value: string;
}

function getCredential(): TmdbCredential {
    const configuredToken = process.env.TMDB_API_TOKEN?.trim();
    if (configuredToken) {
        const token = configuredToken.replace(/^Bearer\s+/i, '').trim();
        return {
            kind: /^[a-f\d]{32}$/i.test(token) ? 'api-key' : 'bearer',
            value: token,
        };
    }

    const apiKey = process.env.TMDB_API_KEY?.trim();
    if (apiKey) return { kind: 'api-key', value: apiKey };
    throw new TmdbConfigurationError();
}

async function tmdbRequest(path: string, params: Record<string, string>, locale: SupportedOutputLocale): Promise<unknown> {
    const url = new URL(`${TMDB_API_URL}${path}`);
    const credential = getCredential();
    const language = getOutputLocaleMetadata(locale).formatTag;
    url.searchParams.set('language', language);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (credential.kind === 'api-key') url.searchParams.set('api_key', credential.value);

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                ...(credential.kind === 'bearer' ? { 'Authorization': `Bearer ${credential.value}` } : {}),
            },
            signal: AbortSignal.timeout(TMDB_REQUEST_TIMEOUT_MS),
        });
    } catch (error) {
        if (error instanceof TmdbConfigurationError) throw error;
        throw new TmdbRequestError(null);
    }
    if (response.status === 401 || response.status === 403) {
        throw new TmdbAuthenticationError(response.status);
    }
    if (!response.ok) throw new TmdbRequestError(response.status);

    try {
        return await response.json();
    } catch {
        throw new TmdbRequestError(response.status);
    }
}

export async function searchTmdbMedia(
    query: string,
    type: TmdbSearchType = 'all',
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): Promise<TmdbMedia[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const path = type === 'all' ? '/search/multi' : `/search/${type}`;
    const raw = await tmdbRequest(path, {
        query: normalizedQuery,
        include_adult: 'false',
        page: '1',
    }, locale) as TmdbSearchResponse;
    if (!Array.isArray(raw.results)) return [];

    return raw.results
        .map(result => normalizeTmdbMedia(result, type === 'all' ? undefined : type))
        .filter((result): result is TmdbMedia => result !== null)
        .slice(0, 10);
}

export async function getTmdbMedia(
    type: TmdbMediaType,
    id: number,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): Promise<TmdbMedia | null> {
    if (!Number.isInteger(id) || id <= 0) return null;
    return normalizeTmdbMedia(await tmdbRequest(`/${type}/${id}`, {}, locale), type);
}

export function getTmdbImageUrl(path: string | null, size: 'w500' | 'w780' = 'w500'): string | null {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function getTmdbWebUrl(media: Pick<TmdbMedia, 'id' | 'type'>): string {
    return `https://www.themoviedb.org/${media.type}/${media.id}`;
}

function normalizeTmdbMedia(value: unknown, forcedType?: TmdbMediaType): TmdbMedia | null {
    if (!isRecord(value) || value.adult === true) return null;
    const type = forcedType ?? (value.media_type === 'movie' || value.media_type === 'tv' ? value.media_type : null);
    if (!type) return null;

    const id = numberValue(value.id);
    const title = stringValue(type === 'movie' ? value.title : value.name);
    if (id === null || !Number.isInteger(id) || id <= 0 || !title) return null;

    const originalTitle = stringValue(type === 'movie' ? value.original_title : value.original_name);
    const releaseDate = stringValue(type === 'movie' ? value.release_date : value.first_air_date);
    const episodeRuntime = Array.isArray(value.episode_run_time)
        ? value.episode_run_time.find(item => typeof item === 'number' && item > 0)
        : null;
    const genres = Array.isArray(value.genres)
        ? value.genres.flatMap(genre => isRecord(genre) && typeof genre.name === 'string' ? [genre.name] : [])
        : [];

    return {
        id,
        type,
        title,
        originalTitle: originalTitle && originalTitle !== title ? originalTitle : null,
        overview: stringValue(value.overview),
        releaseDate,
        originalLanguage: stringValue(value.original_language),
        posterPath: stringValue(value.poster_path),
        backdropPath: stringValue(value.backdrop_path),
        voteAverage: numberValue(value.vote_average),
        voteCount: numberValue(value.vote_count),
        popularity: numberValue(value.popularity),
        runtimeMinutes: type === 'movie' ? numberValue(value.runtime) : numberValue(episodeRuntime),
        seasonCount: type === 'tv' ? numberValue(value.number_of_seasons) : null,
        episodeCount: type === 'tv' ? numberValue(value.number_of_episodes) : null,
        status: stringValue(value.status),
        genres,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
