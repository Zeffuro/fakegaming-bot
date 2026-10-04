import { getTwitchClipBotToken, invalidateTwitchClipBotToken } from './botAuth.js';

export class TwitchClipApiError extends Error {
    constructor(public readonly status: number) {
        super(`Twitch clip API returned ${status}`);
    }
}

export async function twitchClipHelix(path: string, init: RequestInit = {}): Promise<Response> {
    const { accessToken } = await getTwitchClipBotToken();
    const response = await fetch(`https://api.twitch.tv/helix/${path}`, {
        ...init,
        headers: {
            ...init.headers,
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID ?? '',
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401) invalidateTwitchClipBotToken();
    if (!response.ok) throw new TwitchClipApiError(response.status);
    return response;
}

export interface TwitchClipMetadata {
    id: string;
    url: string;
    title: string;
    thumbnail_url: string;
    broadcaster_name: string;
    broadcaster_id: string;
    duration: number;
}

export async function createTwitchCommandClip(broadcasterId: string, duration: number): Promise<string> {
    const query = new URLSearchParams({ broadcaster_id: broadcasterId, duration: String(duration) });
    const response = await twitchClipHelix(`clips?${query}`, { method: 'POST' });
    const result = await response.json() as { data?: { id?: string }[] };
    const id = result.data?.[0]?.id;
    if (!id || !/^[a-zA-Z0-9_-]{1,255}$/.test(id)) throw new Error('Twitch returned no valid clip ID');
    return id;
}

export async function getTwitchCommandClip(clipId: string): Promise<TwitchClipMetadata | null> {
    const response = await twitchClipHelix(`clips?${new URLSearchParams({ id: clipId })}`);
    const result = await response.json() as { data?: TwitchClipMetadata[] };
    const clip = result.data?.[0];
    return clip?.id === clipId ? clip : null;
}
