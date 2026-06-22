export interface SteamAppSearchResult {
    steamAppId: number;
    appName: string;
    score: number;
}

export type SteamAppResolveResult =
    | { status: 'resolved'; app: SteamAppSearchResult }
    | { status: 'ambiguous'; suggestions: SteamAppSearchResult[] }
    | { status: 'not_found'; suggestions: SteamAppSearchResult[] };

export interface ParsedSteamAppInput {
    steamAppId: number;
    appName?: string;
}

export interface SteamAppResolverOptions {
    fetchImpl?: SteamFetch;
    apiKey?: string | null;
    limit?: number;
    forceRefresh?: boolean;
    cacheTtlMs?: number;
}

export type SteamFetch = (url: string, init?: RequestInit) => Promise<SteamFetchResponse>;

interface SteamFetchResponse {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}

interface SteamAppEntry {
    appid: number;
    name: string;
}

interface SteamAppListCache {
    apps: SteamAppEntry[];
    expiresAt: number;
}

const PUBLIC_APP_LIST_URL = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
const STORE_SERVICE_APP_LIST_URL = 'https://partner.steam-api.com/IStoreService/GetAppList/v1/';
const DEFAULT_APP_LIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 25;
const CONFIDENT_MATCH_SCORE = 875;

let appListCache: SteamAppListCache | null = null;
let pendingAppList: Promise<SteamAppEntry[]> | null = null;

export function parseSteamAppInput(input: string): ParsedSteamAppInput | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const explicitId = /^(?:steam:)?(\d{1,10})$/i.exec(trimmed);
    if (explicitId) {
        return toParsedSteamAppInput(explicitId[1]);
    }

    const autocompleteId = /\((\d{1,10})\)\s*$/.exec(trimmed);
    if (autocompleteId) {
        return toParsedSteamAppInput(autocompleteId[1], trimmed.replace(autocompleteId[0], '').trim());
    }

    const protocolId = /^steam:\/\/(?:rungameid|store)\/(\d{1,10})(?:\/|$)/i.exec(trimmed);
    if (protocolId) {
        return toParsedSteamAppInput(protocolId[1]);
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (!hostname.endsWith('steampowered.com') && !hostname.endsWith('steamcommunity.com')) {
        return null;
    }

    const pathMatch = /^\/app\/(\d{1,10})(?:\/([^/?#]+))?/i.exec(url.pathname);
    if (pathMatch) {
        return toParsedSteamAppInput(pathMatch[1], pathMatch[2] ? formatSteamSlugName(pathMatch[2]) : undefined);
    }

    const searchAppId = url.searchParams.get('appid') ?? url.searchParams.get('appId') ?? url.searchParams.get('id');
    return searchAppId ? toParsedSteamAppInput(searchAppId) : null;
}

export function formatSteamStoreUrl(steamAppId: number): string {
    return `https://store.steampowered.com/app/${steamAppId}/`;
}

export async function searchSteamApps(query: string, options: SteamAppResolverOptions = {}): Promise<SteamAppSearchResult[]> {
    const limit = normalizeLimit(options.limit);
    const parsed = parseSteamAppInput(query);
    if (parsed) {
        const app = await getSteamAppById(parsed.steamAppId, options);
        return [{
            steamAppId: parsed.steamAppId,
            appName: app?.name ?? parsed.appName ?? `Steam app ${parsed.steamAppId}`,
            score: 1000,
        }];
    }

    const normalizedQuery = normalizeSteamAppName(query);
    if (!normalizedQuery) return [];

    const apps = await getSteamAppList(options);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const compactQuery = compactName(normalizedQuery);
    const scored = new Map<number, SteamAppSearchResult>();

    for (const app of apps) {
        if (!app.name) continue;
        const score = scoreSteamApp(normalizedQuery, compactQuery, queryTokens, app.name);
        if (score <= 0) continue;

        const previous = scored.get(app.appid);
        if (!previous || previous.score < score) {
            scored.set(app.appid, {
                steamAppId: app.appid,
                appName: app.name,
                score,
            });
        }
    }

    return [...scored.values()]
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            if (left.appName.length !== right.appName.length) return left.appName.length - right.appName.length;
            return left.appName.localeCompare(right.appName);
        })
        .slice(0, limit);
}

export async function resolveSteamAppInput(input: string, options: SteamAppResolverOptions = {}): Promise<SteamAppResolveResult> {
    const parsed = parseSteamAppInput(input);
    if (parsed) {
        const app = await getSteamAppById(parsed.steamAppId, options);
        return {
            status: 'resolved',
            app: {
                steamAppId: parsed.steamAppId,
                appName: app?.name ?? parsed.appName ?? `Steam app ${parsed.steamAppId}`,
                score: 1000,
            },
        };
    }

    const suggestions = await searchSteamApps(input, options);
    if (suggestions.length === 0) {
        return { status: 'not_found', suggestions: [] };
    }

    const normalizedInput = normalizeSteamAppName(input);
    const exact = suggestions.find((suggestion) => normalizeSteamAppName(suggestion.appName) === normalizedInput);
    if (exact) {
        return { status: 'resolved', app: exact };
    }

    const [first, second] = suggestions;
    if (first && first.score >= CONFIDENT_MATCH_SCORE && (!second || first.score - second.score >= 80)) {
        return { status: 'resolved', app: first };
    }

    return { status: 'ambiguous', suggestions };
}

export async function getSteamAppById(steamAppId: number, options: SteamAppResolverOptions = {}): Promise<SteamAppEntry | null> {
    if (!Number.isInteger(steamAppId) || steamAppId <= 0) return null;
    const apps = await getSteamAppList(options);
    return apps.find((app) => app.appid === steamAppId) ?? null;
}

export async function getSteamAppList(options: SteamAppResolverOptions = {}): Promise<SteamAppEntry[]> {
    const now = Date.now();
    const ttlMs = options.cacheTtlMs ?? DEFAULT_APP_LIST_CACHE_TTL_MS;
    if (!options.forceRefresh && appListCache && appListCache.expiresAt > now) {
        return appListCache.apps;
    }

    if (!options.forceRefresh && pendingAppList) {
        return pendingAppList;
    }

    pendingAppList = loadSteamAppList(options)
        .then((apps) => {
            appListCache = {
                apps,
                expiresAt: Date.now() + ttlMs,
            };
            return apps;
        })
        .finally(() => {
            pendingAppList = null;
        });

    return pendingAppList;
}

export function clearSteamAppListCache(): void {
    appListCache = null;
    pendingAppList = null;
}

export function normalizeSteamAppName(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function normalizeLimit(value: number | undefined): number {
    if (value === undefined || !Number.isInteger(value) || value <= 0) return DEFAULT_SEARCH_LIMIT;
    return Math.min(value, MAX_SEARCH_LIMIT);
}

function toParsedSteamAppInput(rawAppId: string, rawName?: string): ParsedSteamAppInput | null {
    const steamAppId = Number(rawAppId);
    if (!Number.isInteger(steamAppId) || steamAppId <= 0) return null;
    const appName = rawName?.trim();
    return {
        steamAppId,
        ...(appName ? { appName } : {}),
    };
}

function formatSteamSlugName(slug: string): string | undefined {
    try {
        const decoded = decodeURIComponent(slug);
        const normalized = decoded.replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ');
        return normalized.length > 0 ? normalized : undefined;
    } catch {
        return undefined;
    }
}

function compactName(value: string): string {
    return value.replace(/\s+/g, '');
}

function scoreSteamApp(normalizedQuery: string, compactQuery: string, queryTokens: string[], appName: string): number {
    const normalizedName = normalizeSteamAppName(appName);
    if (!normalizedName) return 0;
    if (normalizedName === normalizedQuery) return 1000;

    const compactAppName = compactName(normalizedName);
    if (compactAppName === compactQuery) return 960;

    if (normalizedName.startsWith(normalizedQuery)) {
        return Math.max(820, 930 - Math.min(100, normalizedName.length - normalizedQuery.length));
    }

    if (compactAppName.startsWith(compactQuery)) {
        return Math.max(780, 880 - Math.min(100, compactAppName.length - compactQuery.length));
    }

    const substringIndex = normalizedName.indexOf(normalizedQuery);
    if (substringIndex >= 0) {
        return Math.max(650, 780 - Math.min(100, substringIndex * 5));
    }

    const compactIndex = compactAppName.indexOf(compactQuery);
    if (compactIndex >= 0) {
        return Math.max(620, 740 - Math.min(100, compactIndex * 5));
    }

    if (queryTokens.length > 0 && queryTokens.every((token) => normalizedName.includes(token))) {
        return 600 - Math.min(80, normalizedName.length - normalizedQuery.length);
    }

    return 0;
}

async function loadSteamAppList(options: SteamAppResolverOptions): Promise<SteamAppEntry[]> {
    const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init) as Promise<SteamFetchResponse>);
    const apiKey = normalizeApiKey(options.apiKey ?? process.env.STEAM_WEB_API_KEY ?? process.env.STEAM_API_KEY);

    if (apiKey) {
        try {
            const apps = await fetchStoreServiceAppList(fetchImpl, apiKey);
            if (apps.length > 0) return apps;
        } catch {
            // Fall back to the public app-list endpoint when the keyed service is unavailable.
        }
    }

    return fetchPublicAppList(fetchImpl);
}

function normalizeApiKey(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

async function fetchPublicAppList(fetchImpl: SteamFetch): Promise<SteamAppEntry[]> {
    const response = await fetchImpl(PUBLIC_APP_LIST_URL);
    if (!response.ok) {
        throw new Error(`Steam app list request failed with status ${response.status}`);
    }

    const body = await response.json();
    return normalizeSteamApps(readPublicApps(body));
}

async function fetchStoreServiceAppList(fetchImpl: SteamFetch, apiKey: string): Promise<SteamAppEntry[]> {
    const apps: SteamAppEntry[] = [];
    let lastAppId = 0;

    for (let page = 0; page < 10; page += 1) {
        const inputJson = JSON.stringify({
            include_games: true,
            include_dlc: false,
            include_software: false,
            include_videos: false,
            max_results: 50000,
            ...(lastAppId > 0 ? { last_appid: lastAppId } : {}),
        });
        const url = new URL(STORE_SERVICE_APP_LIST_URL);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('format', 'json');
        url.searchParams.set('input_json', inputJson);

        const response = await fetchImpl(url.toString());
        if (!response.ok) {
            throw new Error(`Steam store app list request failed with status ${response.status}`);
        }

        const body = await response.json();
        const pageResponse = readStoreServiceResponse(body);
        const pageApps = normalizeSteamApps(pageResponse.apps);
        apps.push(...pageApps);

        if (!pageResponse.haveMoreResults || !pageResponse.lastAppId || pageResponse.lastAppId === lastAppId) {
            break;
        }

        lastAppId = pageResponse.lastAppId;
    }

    return apps;
}

function readPublicApps(body: unknown): unknown[] {
    if (!isRecord(body)) return [];
    const applist = body.applist;
    if (!isRecord(applist) || !Array.isArray(applist.apps)) return [];
    return applist.apps;
}

function readStoreServiceResponse(body: unknown): { apps: unknown[]; lastAppId: number | null; haveMoreResults: boolean } {
    if (!isRecord(body) || !isRecord(body.response)) {
        return { apps: [], lastAppId: null, haveMoreResults: false };
    }

    const apps = Array.isArray(body.response.apps) ? body.response.apps : [];
    const rawLastAppId = body.response.last_appid ?? body.response.lastAppId;
    const lastAppId = typeof rawLastAppId === 'number' && Number.isInteger(rawLastAppId) ? rawLastAppId : null;
    const haveMoreResults = body.response.have_more_results === true || body.response.haveMoreResults === true;
    return { apps, lastAppId, haveMoreResults };
}

function normalizeSteamApps(rawApps: unknown[]): SteamAppEntry[] {
    const apps = new Map<number, SteamAppEntry>();

    for (const rawApp of rawApps) {
        if (!isRecord(rawApp)) continue;
        const rawAppId = rawApp.appid ?? rawApp.app_id ?? rawApp.appId;
        const rawName = rawApp.name ?? rawApp.app_name ?? rawApp.title;
        if (typeof rawAppId !== 'number' || !Number.isInteger(rawAppId) || rawAppId <= 0) continue;
        if (typeof rawName !== 'string' || rawName.trim().length === 0) continue;
        apps.set(rawAppId, {
            appid: rawAppId,
            name: rawName.trim(),
        });
    }

    return [...apps.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
