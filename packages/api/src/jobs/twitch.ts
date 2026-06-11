import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, formatMinuteKey } from '@zeffuro/fakegaming-common/jobs';
import { isWithinQuietHours, toMillis } from '@zeffuro/fakegaming-common/utils';
import { renderTemplate } from '@zeffuro/fakegaming-common/utils';
import { formatUptimeShort } from '@zeffuro/fakegaming-common/utils';
import { sendChannelMessagePayload } from '../utils/discord.js';
import { recordJobRun } from './status.js';

interface TwitchStreamConfigPlain {
    id?: number | string;
    guildId: string;
    discordChannelId: string;
    twitchUsername: string;
    isLive?: boolean;
    customMessage?: string | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number | null;
    lastNotifiedAt?: string | number | Date | null;
}

interface HelixUser { id: string; login: string; display_name?: string; profile_image_url?: string }
interface HelixStream { id: string; user_id: string; title: string; viewer_count?: number; started_at?: string; thumbnail_url?: string; game_id?: string }
interface HelixGame { id: string; name: string }

const TWITCH_HELIX_BATCH_SIZE = 100;
const TWITCH_USER_CACHE_TTL_MS = 60 * 60 * 1000;
const TWITCH_STARTUP_DEFAULT_DELAY_SECONDS = 5;

let _twitchAppToken: { token: string; expiresAt: number } | null = null;
const twitchUserCache = new Map<string, { user: HelixUser; expiresAt: number }>();

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function normalizeTwitchLogin(login: string): string {
    return login.trim().toLowerCase();
}

function getTwitchStartupJitterSeconds(): number {
    const jitterMs = Number.parseInt(process.env.TWITCH_STARTUP_JITTER_MS ?? '0', 10);
    if (!Number.isFinite(jitterMs) || jitterMs <= 0) {
        return 0;
    }
    return Math.floor(Math.random() * jitterMs) / 1000;
}

async function getTwitchAppToken(nowMs = Date.now()): Promise<string> {
    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        throw new Error('[api:twitch] Missing TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET');
    }
    if (_twitchAppToken && _twitchAppToken.expiresAt - nowMs > 60_000) {
        return _twitchAppToken.token;
    }
    const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[api:twitch] Failed to fetch app token: ${res.status} ${body.slice(0, 256)}`);
    }
    const data = await res.json() as { access_token: string; expires_in?: number };
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    _twitchAppToken = { token: data.access_token, expiresAt: nowMs + (expiresIn * 1000) };
    return data.access_token;
}

async function helixGetUsersByLogin(token: string, clientId: string, logins: string[]): Promise<HelixUser[]> {
    const uniqueLogins = Array.from(new Set(logins.map(normalizeTwitchLogin).filter(Boolean)));
    if (uniqueLogins.length === 0) return [];

    const users: HelixUser[] = [];
    const missingLogins: string[] = [];
    const nowMs = Date.now();
    for (const login of uniqueLogins) {
        const cached = twitchUserCache.get(login);
        if (cached && cached.expiresAt > nowMs) {
            users.push(cached.user);
        } else {
            missingLogins.push(login);
        }
    }

    for (const chunk of chunkArray(missingLogins, TWITCH_HELIX_BATCH_SIZE)) {
        const url = `https://api.twitch.tv/helix/users?${chunk.map((l) => `login=${encodeURIComponent(l)}`).join('&')}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId }
        });
        if (!res.ok) continue;
        const json = await res.json();
        const fetched = (json?.data ?? []) as HelixUser[];
        for (const user of fetched) {
            const login = normalizeTwitchLogin(user.login);
            twitchUserCache.set(login, { user, expiresAt: nowMs + TWITCH_USER_CACHE_TTL_MS });
            users.push(user);
        }
    }

    return users;
}

async function helixGetStreamsByUserIds(token: string, clientId: string, userIds: string[]): Promise<HelixStream[]> {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return [];
    const streams: HelixStream[] = [];
    for (const chunk of chunkArray(uniqueUserIds, TWITCH_HELIX_BATCH_SIZE)) {
        const url = `https://api.twitch.tv/helix/streams?${chunk.map((id) => `user_id=${encodeURIComponent(id)}`).join('&')}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId } });
        if (!res.ok) continue;
        const json = await res.json();
        streams.push(...((json?.data ?? []) as HelixStream[]));
    }
    return streams;
}

async function helixGetGamesByIds(token: string, clientId: string, gameIds: string[]): Promise<Map<string, string>> {
    const ids = Array.from(new Set(gameIds.filter(Boolean)));
    if (ids.length === 0) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const chunk of chunkArray(ids, TWITCH_HELIX_BATCH_SIZE)) {
        const url = `https://api.twitch.tv/helix/games?${chunk.map((id) => `id=${encodeURIComponent(id)}`).join('&')}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId } });
        if (!res.ok) continue;
        const json = await res.json();
        const arr = (json?.data ?? []) as HelixGame[];
        for (const g of arr) map.set(g.id, g.name);
    }
    return map;
}

function buildTwitchEmbedAndContent(opts: { user: HelixUser; stream: HelixStream; gameName?: string | null; customMessage?: string | null }): { content: string; payload: Record<string, unknown> } {
    const { user, stream } = opts;
    const gameName = opts.gameName ?? null;
    const url = `https://twitch.tv/${user.login}`;
    const urlSafe = `<${url}>`;
    const startedAtMs = stream.started_at ? Date.parse(stream.started_at) : NaN;
    const uptimeMs = Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : null;
    const uptimeStr = typeof uptimeMs === 'number' && uptimeMs > 0 ? formatUptimeShort(uptimeMs) : null;

    const embed: Record<string, unknown> = {
        title: `${user.display_name || user.login} is now live!`,
        url,
        author: { name: user.display_name || user.login, icon_url: user.profile_image_url || undefined, url },
        description: stream.title || 'Live on Twitch! ',
        color: 0x9146ff,
        timestamp: new Date().toISOString(),
        fields: [
            { name: 'Viewers', value: String(stream.viewer_count ?? 'N/A'), inline: true }
        ]
    };
    if (gameName) (embed as any).fields.push({ name: 'Game', value: gameName, inline: true });
    if (uptimeStr) (embed as any).fields.push({ name: 'Uptime', value: uptimeStr, inline: true });
    if (stream.thumbnail_url) (embed as any).image = { url: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360') };
    if (user.profile_image_url) (embed as any).thumbnail = { url: user.profile_image_url };

    const tokens = {
        streamer: user.display_name || user.login || '',
        title: stream.title || '',
        game: gameName || '',
        url: urlSafe,
        uptime: uptimeStr || '',
        viewers: typeof stream.viewer_count === 'number' ? String(stream.viewer_count) : ''
    };
    let content = `Hey @everyone, ${user.display_name || user.login} is now live! ${urlSafe}`;
    if (opts.customMessage) {
        const tmpl = String(opts.customMessage);
        content = renderTemplate(tmpl, tokens);
        if (!tmpl.includes('{url}')) content = `${content}\n${urlSafe}`;
    }

    return { content, payload: { content, embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Watch Stream', url }] }] } };
}

async function processTwitchPoll(log = getLogger({ name: 'api:jobs:twitch' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const manager = cm.twitchManager as unknown as { getAllStreams: () => Promise<TwitchStreamConfigPlain[]> };
    const notifications = cm.notificationsManager as unknown as { has: (p: string, id: string) => Promise<boolean>; recordIfNew: (x: { provider: string; eventId: string; channelId: string; guildId: string }) => Promise<void> };

    const streams = await manager.getAllStreams();
    if (!streams.length) return { processed: 0, errors: 0 };

    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const token = await getTwitchAppToken();

    // Resolve users by login and streams by user id in batches
    const logins = streams.map(s => s.twitchUsername).filter(Boolean);
    const users = await helixGetUsersByLogin(token, clientId, logins);
    const idByLogin = new Map(users.map(u => [u.login.toLowerCase(), u.id] as const));
    const streamsByUser = await helixGetStreamsByUserIds(token, clientId, users.map(u => u.id));
    const streamByUserId = new Map(streamsByUser.map(s => [s.user_id, s] as const));
    const gameIds = streamsByUser.map(s => s.game_id).filter((g): g is string => typeof g === 'string');
    const gameNameById = await helixGetGamesByIds(token, clientId, gameIds);

    let processed = 0; let errors = 0;

    for (const cfg of streams) {
        try {
            const userId = idByLogin.get(normalizeTwitchLogin(cfg.twitchUsername));
            if (!userId) continue;
            const stream = streamByUserId.get(userId) ?? null;
            const isLive = stream !== null && stream !== undefined;

            if (isLive && !cfg.isLive) {
                const now = new Date();
                const eventId = String(stream!.id);
                const already = await (notifications as any).hasForGuild?.('twitch', eventId, cfg.guildId)
                    ?? await notifications.has('twitch', eventId);
                const suppressedByQuiet = isWithinQuietHours(cfg.quietHoursStart ?? null, cfg.quietHoursEnd ?? null, now);
                const lastNotifiedDate = cfg.lastNotifiedAt ? new Date(toMillis(cfg.lastNotifiedAt)) : null;
                const cooldown = typeof cfg.cooldownMinutes === 'number' && cfg.cooldownMinutes > 0 && lastNotifiedDate
                    ? (now.getTime() - lastNotifiedDate.getTime()) < cfg.cooldownMinutes * 60_000
                    : false;
                if (!already && !suppressedByQuiet && !cooldown) {
                    const user = users.find(u => u.id === userId)!;
                    const gameName = stream?.game_id ? (gameNameById.get(stream.game_id) ?? null) : null;
                    const built = buildTwitchEmbedAndContent({ user, stream: stream!, gameName, customMessage: cfg.customMessage ?? null });
                    const sent = await sendChannelMessagePayload(cfg.discordChannelId, built.payload);
                    if (sent && typeof (sent as any).id === 'string') {
                        (cfg as any).lastNotifiedAt = now;
                        processed += 1;
                        await notifications.recordIfNew({ provider: 'twitch', eventId, channelId: cfg.discordChannelId, guildId: cfg.guildId });
                    }
                }
                (cfg as any).isLive = true;
                await (cm.twitchManager as any).upsert?.(cfg, ['id'])?.catch(async () => { await (cfg as any).save?.(); });
            } else if (!isLive && cfg.isLive) {
                (cfg as any).isLive = false;
                await (cm.twitchManager as any).upsert?.(cfg, ['id'])?.catch(async () => { await (cfg as any).save?.(); });
            }
        } catch (err) {
            errors += 1;
            log.error({ err, username: cfg.twitchUsername }, 'Error processing Twitch config');
        }
    }

    return { processed, errors };
}

/**
 * Register Twitch polling job.
 * - Polls every ~60 seconds with singleton scheduling.
 */
export async function registerTwitchJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:twitch' });

    queue.on('twitch:poll', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await processTwitchPoll(log);
            const delaySec = 60;
            const nextAt = new Date(Date.now() + delaySec * 1000);
            const key = `twitch:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(queue, 'twitch:poll', {}, delaySec, key);
            recordJobRun('twitch', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('twitch', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    // Schedule initial and immediate run
    const startupJitter = getTwitchStartupJitterSeconds();
    const initDelay = TWITCH_STARTUP_DEFAULT_DELAY_SECONDS + startupJitter;
    await scheduleSingleton(queue, 'twitch:poll', {}, initDelay, `twitch:init:${formatMinuteKey(new Date(now.getTime() + initDelay * 1000))}`);
    await scheduleSingleton(queue, 'twitch:poll', {}, startupJitter, `twitch:catchup:${formatMinuteKey(new Date(now.getTime() + startupJitter * 1000))}`);

    log.info('Scheduled Twitch polling job');
}
