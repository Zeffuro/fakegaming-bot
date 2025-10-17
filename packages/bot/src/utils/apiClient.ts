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

/**
 * Verify a Twitch username exists via API resolver.
 */
export async function verifyTwitchUsernameApi(username: string): Promise<{ exists: boolean; id?: string; login?: string; displayName?: string } | null> {
    if (!username) return { exists: false } as const;
    const base = getApiBaseUrl();
    const url = `${base}/twitch/verify?username=${encodeURIComponent(username)}`;
    try {
        const res = await fetch(url, { headers: getServiceHeaders() });
        if (!res.ok) {
            let body: unknown;
            try {
                const text = await res.text();
                try {
                    body = JSON.parse(text);
                } catch {
                    body = text;
                }
            } catch {
                body = null;
            }
            log.warn({ status: res.status, url, body }, '[bot] verifyTwitchUsernameApi non-OK response');
            return { exists: false } as const;
        }
        const json = await res.json();
        if (typeof (json as any)?.exists !== 'boolean') {
            log.warn({ url, body: json }, '[bot] verifyTwitchUsernameApi invalid payload');
            return { exists: false } as const;
        }
        return json as { exists: boolean; id?: string; login?: string; displayName?: string };
    } catch (err) {
        log.warn({ err, url }, '[bot] verifyTwitchUsernameApi request failed');
        return null;
    }
}

/**
 * Resolve a YouTube channel identifier (handle/username/UC-Id) to channelId via API resolver.
 */
export async function resolveYoutubeChannelIdApi(identifier: string): Promise<string | null> {
    if (!identifier) return null;
    const base = getApiBaseUrl();
    const url = `${base}/youtube/resolve?identifier=${encodeURIComponent(identifier)}`;
    try {
        const res = await fetch(url, { headers: getServiceHeaders() });
        if (!res.ok) {
            let body: unknown;
            try {
                const text = await res.text();
                try {
                    body = JSON.parse(text);
                } catch {
                    body = text;
                }
            } catch {
                body = null;
            }
            log.warn({ status: res.status, url, body }, '[bot] resolveYoutubeChannelIdApi non-OK response');
            return null;
        }
        const json = await res.json();
        const channelId = typeof (json as any)?.channelId === 'string' || (json as any)?.channelId === null ? (json as any).channelId : undefined;
        if (typeof channelId === 'undefined') {
            log.warn({ url, body: json }, '[bot] resolveYoutubeChannelIdApi invalid payload');
            return null;
        }
        return channelId;
    } catch (err) {
        log.warn({ err, url }, '[bot] resolveYoutubeChannelIdApi request failed');
        return null;
    }
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
    // Assuming API exposes this endpoint; tests will mock this function in any case
    const url = `${base}/patchnotes/latest?game=${encodeURIComponent(game)}`;
    try {
        const res = await fetch(url, { headers: getServiceHeaders() });
        if (!res.ok) return null;
        const json = await res.json();
        // Accept either direct object or { patch: {...} }
        const patch = (json && (json.patch ?? json)) as Partial<LatestPatchNoteDto>;
        if (!patch || typeof patch.title !== 'string' || typeof patch.url !== 'string' || typeof patch.game !== 'string') {
            return null;
        }
        return {
            game: patch.game,
            title: patch.title,
            content: typeof patch.content === 'string' ? patch.content : '',
            url: patch.url,
            publishedAt: patch.publishedAt ?? new Date(),
            imageUrl: patch.imageUrl ?? null,
            logoUrl: patch.logoUrl ?? null,
            accentColor: typeof patch.accentColor === 'number' ? patch.accentColor : null,
        };
    } catch {
        return null;
    }
}
