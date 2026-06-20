// filepath: packages/bot/src/utils/apiClient.ts

import { getLogger } from '@zeffuro/fakegaming-common';

/**
 * Determine the API base URL for the bot to call. Defaults to http://localhost:3001/api.
 */
export function getApiBaseUrl(): string {
    const fromEnv = process.env.BOT_API_URL || process.env.API_URL || '';
    const url = fromEnv.trim() || 'http://localhost:3001/api';
    return url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;
}

function getServiceHeaders(): Record<string, string> {
    const token = (process.env.SERVICE_API_TOKEN || '').trim();
    return token ? { 'x-service-token': token } : {};
}

const log = getLogger({ name: 'bot:api' });

type ApiJsonResult = { ok: true; body: unknown } | { ok: false; reason: 'non-ok' | 'request-failed' };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function readResponseBody(res: Response): Promise<unknown> {
    try {
        const text = await res.text();
        try {
            return JSON.parse(text) as unknown;
        } catch {
            return text;
        }
    } catch {
        return null;
    }
}

async function fetchApiJson(url: string, operation: string): Promise<ApiJsonResult> {
    try {
        const res = await fetch(url, { headers: getServiceHeaders() });
        if (!res.ok) {
            const body = await readResponseBody(res);
            log.warn({ status: res.status, url, body }, `[bot] ${operation} non-OK response`);
            return { ok: false, reason: 'non-ok' };
        }

        return { ok: true, body: await res.json() };
    } catch (err) {
        log.warn({ err, url }, `[bot] ${operation} request failed`);
        return { ok: false, reason: 'request-failed' };
    }
}

/**
 * Verify a Twitch username exists via API resolver.
 */
export async function verifyTwitchUsernameApi(username: string): Promise<{ exists: boolean; id?: string; login?: string; displayName?: string } | null> {
    if (!username) return { exists: false } as const;
    const base = getApiBaseUrl();
    const url = `${base}/twitch/verify?username=${encodeURIComponent(username)}`;
    const result = await fetchApiJson(url, 'verifyTwitchUsernameApi');
    if (!result.ok) return result.reason === 'non-ok' ? { exists: false } as const : null;

    if (!isRecord(result.body) || typeof result.body.exists !== 'boolean') {
        log.warn({ url, body: result.body }, '[bot] verifyTwitchUsernameApi invalid payload');
        return { exists: false } as const;
    }

    return {
        exists: result.body.exists,
        id: typeof result.body.id === 'string' ? result.body.id : undefined,
        login: typeof result.body.login === 'string' ? result.body.login : undefined,
        displayName: typeof result.body.displayName === 'string' ? result.body.displayName : undefined,
    };
}

/**
 * Resolve a YouTube channel identifier (handle/username/UC-Id) to channelId via API resolver.
 */
export async function resolveYoutubeChannelIdApi(identifier: string): Promise<string | null> {
    if (!identifier) return null;
    const base = getApiBaseUrl();
    const url = `${base}/youtube/resolve?identifier=${encodeURIComponent(identifier)}`;
    const result = await fetchApiJson(url, 'resolveYoutubeChannelIdApi');
    if (!result.ok) return null;

    const channelId = isRecord(result.body) ? result.body.channelId : undefined;
    if (typeof channelId !== 'string' && channelId !== null) {
        log.warn({ url, body: result.body }, '[bot] resolveYoutubeChannelIdApi invalid payload');
        return null;
    }

    return channelId;
}

export interface BlueskyProfileVerification {
    exists: boolean;
    did?: string;
    handle?: string;
    displayName?: string;
    avatar?: string;
}

export async function verifyBlueskyHandleApi(handle: string): Promise<BlueskyProfileVerification | null> {
    if (!handle) return { exists: false } as const;
    const base = getApiBaseUrl();
    const url = `${base}/bluesky/profile?handle=${encodeURIComponent(handle)}`;
    const result = await fetchApiJson(url, 'verifyBlueskyHandleApi');
    if (!result.ok) return result.reason === 'non-ok' ? { exists: false } as const : null;

    if (!isRecord(result.body) || typeof result.body.exists !== 'boolean') {
        log.warn({ url, body: result.body }, '[bot] verifyBlueskyHandleApi invalid payload');
        return { exists: false } as const;
    }

    return {
        exists: result.body.exists,
        did: typeof result.body.did === 'string' ? result.body.did : undefined,
        handle: typeof result.body.handle === 'string' ? result.body.handle : undefined,
        displayName: typeof result.body.displayName === 'string' ? result.body.displayName : undefined,
        avatar: typeof result.body.avatar === 'string' ? result.body.avatar : undefined,
    };
}

/**
 * Fetch the latest patch note for a game from the API. Returns a plain object compatible with buildPatchNoteEmbed.
 */
export interface LatestPatchNoteDto {
    game: string;
    title: string;
    content: string;
    url: string;
    publishedAt: string | Date;
    imageUrl?: string | null;
    logoUrl?: string | null;
    accentColor?: number | null;
}

export async function fetchLatestPatchNoteApi(game: string): Promise<LatestPatchNoteDto | null> {
    if (!game) return null;
    const base = getApiBaseUrl();
    const url = `${base}/patchnotes/latest?game=${encodeURIComponent(game)}`;
    const result = await fetchApiJson(url, 'fetchLatestPatchNoteApi');
    if (!result.ok) return null;

    const rawPatch = isRecord(result.body) && 'patch' in result.body ? result.body.patch : result.body;
    if (!isRecord(rawPatch) || typeof rawPatch.title !== 'string' || typeof rawPatch.url !== 'string' || typeof rawPatch.game !== 'string') {
        return null;
    }

    return {
        game: rawPatch.game,
        title: rawPatch.title,
        content: typeof rawPatch.content === 'string' ? rawPatch.content : '',
        url: rawPatch.url,
        publishedAt: typeof rawPatch.publishedAt === 'string' || rawPatch.publishedAt instanceof Date ? rawPatch.publishedAt : new Date(),
        imageUrl: typeof rawPatch.imageUrl === 'string' ? rawPatch.imageUrl : null,
        logoUrl: typeof rawPatch.logoUrl === 'string' ? rawPatch.logoUrl : null,
        accentColor: typeof rawPatch.accentColor === 'number' ? rawPatch.accentColor : null,
    };
}
