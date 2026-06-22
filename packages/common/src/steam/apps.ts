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
const STORE_SERVICE_APP_LIST_URL = 'https://api.steampowered.com/IStoreService/GetAppList/v1/';
const STORE_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/';
const STORE_APP_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';
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

    const apps = await getSteamAppListForSearch(query, options);
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
    try {
        const apps = await getSteamAppList(options);
        const app = apps.find((entry) => entry.appid === steamAppId);
        if (app) return app;
    } catch {
        // Fall through to the public store appdetails endpoint.
    }

    try {
        return await fetchStoreAppDetails(steamAppId, options.fetchImpl ?? defaultSteamFetch);
    } catch {
        return null;
    }
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
    const fetchImpl = options.fetchImpl ?? defaultSteamFetch;
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

async function getSteamAppListForSearch(query: string, options: SteamAppResolverOptions): Promise<SteamAppEntry[]> {
    try {
        const apps = await getSteamAppList(options);
        if (apps.length > 0) return apps;
    } catch {
        // Fall through to Steam Store search. The old public Web API app-list endpoint can return 404.
    }

    try {
        return await fetchStoreSearchApps(query, options.fetchImpl ?? defaultSteamFetch);
    } catch {
        return [];
    }
}

function defaultSteamFetch(url: string, init?: RequestInit): Promise<SteamFetchResponse> {
    return fetch(url, init) as Promise<SteamFetchResponse>;
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
        const url = new URL(STORE_SERVICE_APP_LIST_URL);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('format', 'json');
        url.searchParams.set('include_games', 'true');
        url.searchParams.set('include_dlc', 'false');
        url.searchParams.set('include_software', 'false');
        url.searchParams.set('include_videos', 'false');
        url.searchParams.set('include_hardware', 'false');
        url.searchParams.set('max_results', '50000');
        if (lastAppId > 0) {
            url.searchParams.set('last_appid', String(lastAppId));
        }

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

async function fetchStoreSearchApps(query: string, fetchImpl: SteamFetch): Promise<SteamAppEntry[]> {
    const url = new URL(STORE_SEARCH_URL);
    url.searchParams.set('term', query);
    url.searchParams.set('l', 'english');
    url.searchParams.set('cc', 'US');

    const response = await fetchImpl(url.toString());
    if (!response.ok) {
        throw new Error(`Steam store search request failed with status ${response.status}`);
    }

    const body = await response.json();
    return normalizeSteamApps(readStoreSearchItems(body));
}

async function fetchStoreAppDetails(steamAppId: number, fetchImpl: SteamFetch): Promise<SteamAppEntry | null> {
    const url = new URL(STORE_APP_DETAILS_URL);
    url.searchParams.set('appids', String(steamAppId));
    url.searchParams.set('filters', 'basic');

    const response = await fetchImpl(url.toString());
    if (!response.ok) {
        throw new Error(`Steam appdetails request failed with status ${response.status}`);
    }

    const body = await response.json();
    return readStoreAppDetails(body, steamAppId);
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

function readStoreSearchItems(body: unknown): unknown[] {
    if (!isRecord(body) || !Array.isArray(body.items)) return [];
    return body.items;
}

function readStoreAppDetails(body: unknown, steamAppId: number): SteamAppEntry | null {
    if (!isRecord(body)) return null;
    const entry = body[String(steamAppId)];
    if (!isRecord(entry) || entry.success !== true || !isRecord(entry.data)) return null;
    const apps = normalizeSteamApps([entry.data]);
    return apps[0] ?? null;
}

function normalizeSteamApps(rawApps: unknown[]): SteamAppEntry[] {
    const apps = new Map<number, SteamAppEntry>();

    for (const rawApp of rawApps) {
        if (!isRecord(rawApp)) continue;
        const rawAppId = rawApp.appid ?? rawApp.steam_appid ?? rawApp.app_id ?? rawApp.appId ?? rawApp.id;
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
