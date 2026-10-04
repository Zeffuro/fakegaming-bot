import { z } from 'zod';

export class TwitchClipConfigError extends Error {
    constructor(public readonly code: 'invalid_channel' | 'streamer_not_found' | 'provider_unavailable') {
        super(`Twitch clip configuration failed: ${code}`);
    }
}

async function request(url: string, init: RequestInit) {
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch {
        throw new TwitchClipConfigError('provider_unavailable');
    }
}

export async function validateTwitchClipDestination(guildId: string, discordChannelId: string): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new TwitchClipConfigError('provider_unavailable');
    const response = await request(`https://discord.com/api/channels/${encodeURIComponent(discordChannelId)}`, {
        headers: { Authorization: `Bot ${token}` },
    });
    if (response.status === 403 || response.status === 404) throw new TwitchClipConfigError('invalid_channel');
    if (!response.ok) throw new TwitchClipConfigError('provider_unavailable');
    const parsed = z.object({ guild_id: z.string(), type: z.number() }).safeParse(await response.json().catch(() => null));
    if (!parsed.success || parsed.data.guild_id !== guildId || ![0, 5].includes(parsed.data.type)) {
        throw new TwitchClipConfigError('invalid_channel');
    }
}

export async function resolveTwitchClipBroadcaster(username: string): Promise<{ broadcasterId: string; twitchUsername: string }> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new TwitchClipConfigError('provider_unavailable');
    const tokenResponse = await request('https://id.twitch.tv/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    });
    if (!tokenResponse.ok) throw new TwitchClipConfigError('provider_unavailable');
    const tokens = z.object({ access_token: z.string().min(1) }).safeParse(await tokenResponse.json().catch(() => null));
    if (!tokens.success) throw new TwitchClipConfigError('provider_unavailable');
    const response = await request(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${tokens.data.access_token}`, 'Client-Id': clientId },
    });
    if (!response.ok) throw new TwitchClipConfigError('provider_unavailable');
    const users = z.object({ data: z.array(z.object({ id: z.string().min(1), login: z.string().min(1) })) }).safeParse(await response.json().catch(() => null));
    if (!users.success) throw new TwitchClipConfigError('provider_unavailable');
    const user = users.data.data[0];
    if (!user) throw new TwitchClipConfigError('streamer_not_found');
    return { broadcasterId: user.id, twitchUsername: user.login.toLowerCase() };
}
