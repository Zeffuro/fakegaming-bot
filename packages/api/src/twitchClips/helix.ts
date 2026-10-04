import { getTwitchClipBotToken, invalidateTwitchClipBotToken, type TwitchClipBotToken } from './botAuth.js';

export class TwitchClipApiError extends Error {
    constructor(public readonly status: number) {
        super(`Twitch clip API returned ${status}`);
    }
}

export async function twitchClipHelix(path: string, init: RequestInit = {}, token?: TwitchClipBotToken): Promise<Response> {
    const { accessToken } = token ?? await getTwitchClipBotToken();
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

export async function sendTwitchClipChatMessage(
    broadcasterId: string, parentMessageId: string, message: string, token: TwitchClipBotToken,
): Promise<void> {
    const response = await twitchClipHelix('chat/messages', {
        method: 'POST',
        body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: token.userId,
            message, reply_parent_message_id: parentMessageId }),
    }, token);
    const result = await response.json() as { data?: { is_sent?: boolean }[] };
    if (result.data?.[0]?.is_sent !== true) throw new Error('Twitch dropped the clip reply');
}

export interface TwitchClipMetadata {
    id: string;
    url: string;
    title: string;
    thumbnail_url: string;
    broadcaster_name: string;
    broadcaster_id: string;
    duration: number;
    game_id?: string;
    categoryName?: string;
    created_at?: string;
    video_id?: string;
    vod_offset?: number | null;
    downloadUrl?: string;
}

export async function createTwitchCommandClip(broadcasterId: string, duration: number, title?: string): Promise<string> {
    const query = new URLSearchParams({ broadcaster_id: broadcasterId, duration: String(duration) });
    if (title) query.set('title', title);
    const response = await twitchClipHelix(`clips?${query}`, { method: 'POST' });
    const result = await response.json() as { data?: { id?: string }[] };
    const id = result.data?.[0]?.id;
    if (!id || !/^[a-zA-Z0-9_-]{1,255}$/.test(id)) throw new Error('Twitch returned no valid clip ID');
    return id;
}

const categories = new Map<string, { name: string; expiresAt: number }>();

export async function getTwitchClipCategory(gameId: string | undefined): Promise<string | undefined> {
    if (!gameId || !/^\d+$/.test(gameId)) return undefined;
    const cached = categories.get(gameId);
    if (cached && cached.expiresAt > Date.now()) return cached.name;
    try {
        const response = await twitchClipHelix(`games?${new URLSearchParams({ id: gameId })}`);
        const result = await response.json() as { data?: { id: string; name: string }[] };
        const game = result.data?.find(item => item.id === gameId);
        if (!game?.name) return undefined;
        if (categories.size >= 500) categories.clear();
        categories.set(gameId, { name: game.name, expiresAt: Date.now() + 60 * 60_000 });
        return game.name;
    } catch {
        // Optional category enrichment must not prevent delivery of a created clip.
        return undefined;
    }
}

export async function getTwitchCommandClip(clipId: string): Promise<TwitchClipMetadata | null> {
    const response = await twitchClipHelix(`clips?${new URLSearchParams({ id: clipId })}`);
    const result = await response.json() as { data?: TwitchClipMetadata[] };
    const clip = result.data?.[0];
    return clip?.id === clipId ? clip : null;
}
