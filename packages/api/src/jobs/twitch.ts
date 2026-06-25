import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { formatMinuteKey, scheduleSingleton, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { formatUptimeShort } from '@zeffuro/fakegaming-common/utils';
import { buildDiscordNotificationPayload } from './discordNotificationPayload.js';
import { hasRecordedJobNotification, sendJobNotification, syncLiveNotificationState, type JobNotificationManager } from './jobNotifications.js';
import { upsertOrSaveJobConfig } from './jobConfigPersistence.js';
import { registerRecurringPollingJob } from './recurringPollingJob.js';
import { recordIntegrationFailure, recordIntegrationSuccess } from './integrationHealth.js';
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
    paused?: boolean | null;
    vodFollowupEnabled?: boolean | null;
    vodFollowupDelayMinutes?: number | null;
    lastVodId?: string | null;
}

interface HelixUser { id: string; login: string; display_name?: string; profile_image_url?: string }
interface HelixStream { id: string; user_id: string; title: string; viewer_count?: number; started_at?: string; thumbnail_url?: string; game_id?: string }
interface HelixGame { id: string; name: string }
interface HelixVideo { id: string; user_id: string; title: string; url?: string; created_at?: string; published_at?: string; duration?: string; thumbnail_url?: string; view_count?: number; type?: string }

interface TwitchVodFollowupJobData {
    configId: string | number;
    twitchUserId?: string;
    twitchUsername?: string;
    twitchDisplayName?: string;
    profileImageUrl?: string;
}

interface TwitchPollOptions {
    scheduleVodFollowup?: (config: TwitchStreamConfigPlain, user: HelixUser) => Promise<void>;
}

type TwitchVodFollowupStatus =
    | 'config_missing'
    | 'disabled'
    | 'user_missing'
    | 'no_archive_video'
    | 'duplicate_last_vod'
    | 'duplicate_notification'
    | 'notified'
    | 'send_failed'
    | 'error';

interface TwitchVodFollowupResult {
    processed: number;
    errors: number;
    status: TwitchVodFollowupStatus;
    configId: string | number;
    username?: string;
    vodId?: string;
    eventId?: string;
    delivered?: boolean;
}

const TWITCH_HELIX_BATCH_SIZE = 100;
const TWITCH_USER_CACHE_TTL_MS = 60 * 60 * 1000;
const TWITCH_VIDEO_CACHE_TTL_MS = 2 * 60 * 1000;
const TWITCH_STARTUP_DEFAULT_DELAY_SECONDS = 5;
const TWITCH_VOD_FOLLOWUP_DEFAULT_DELAY_MINUTES = 15;

let _twitchAppToken: { token: string; expiresAt: number } | null = null;
const twitchUserCache = new Map<string, { user: HelixUser; expiresAt: number }>();
const twitchLatestVideoCache = new Map<string, { video: HelixVideo | null; expiresAt: number }>();

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

async function helixGetLatestArchiveVideo(token: string, clientId: string, userId: string): Promise<HelixVideo | null> {
    const cached = twitchLatestVideoCache.get(userId);
    const nowMs = Date.now();
    if (cached && cached.expiresAt > nowMs) {
        return cached.video;
    }

    const url = `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(userId)}&type=archive&first=1`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId } });
    if (!res.ok) {
        return null;
    }
    const json = await res.json();
    const video = ((json?.data ?? []) as HelixVideo[])[0] ?? null;
    twitchLatestVideoCache.set(userId, { video, expiresAt: nowMs + TWITCH_VIDEO_CACHE_TTL_MS });
    return video;
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
    return buildDiscordNotificationPayload({
        defaultContent: `Hey @everyone, ${user.display_name || user.login} is now live! ${urlSafe}`,
        embed,
        buttonLabel: 'Watch Stream',
        buttonUrl: url,
        tokens,
        customMessage: opts.customMessage,
        urlToken: urlSafe,
    });
}

function buildTwitchVodEmbedAndContent(opts: { user: HelixUser; video: HelixVideo }): { content: string; payload: Record<string, unknown> } {
    const { user, video } = opts;
    const streamerName = user.display_name || user.login;
    const url = video.url || `https://www.twitch.tv/videos/${video.id}`;
    const urlSafe = `<${url}>`;
    const publishedAt = video.published_at || video.created_at || null;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [];
    if (video.duration) {
        fields.push({ name: 'Duration', value: video.duration, inline: true });
    }
    if (typeof video.view_count === 'number') {
        fields.push({ name: 'Views', value: String(video.view_count), inline: true });
    }

    const embed: Record<string, unknown> = {
        title: video.title || `Latest VOD from ${streamerName}`,
        url,
        author: { name: streamerName, icon_url: user.profile_image_url || undefined, url: `https://twitch.tv/${user.login}` },
        description: `Latest Twitch archive from ${streamerName}.`,
        color: 0x9146ff,
        timestamp: publishedAt ?? new Date().toISOString(),
        fields,
    };
    if (video.thumbnail_url) {
        (embed as { image?: { url: string } }).image = {
            url: video.thumbnail_url
                .replace('%{width}', '640')
                .replace('%{height}', '360')
                .replace('{width}', '640')
                .replace('{height}', '360'),
        };
    }
    if (user.profile_image_url) {
        (embed as { thumbnail?: { url: string } }).thumbnail = { url: user.profile_image_url };
    }

    return buildDiscordNotificationPayload({
        defaultContent: `Latest VOD from ${streamerName}: ${urlSafe}`,
        embed,
        buttonLabel: 'Watch VOD',
        buttonUrl: url,
        tokens: {
            streamer: streamerName,
            title: video.title || '',
            url: urlSafe,
            duration: video.duration || '',
            views: typeof video.view_count === 'number' ? String(video.view_count) : '',
        },
        urlToken: urlSafe,
    });
}

async function processTwitchPoll(log = getLogger({ name: 'api:jobs:twitch' }), options: TwitchPollOptions = {}): Promise<{ processed: number; errors: number; vodFollowupsScheduled: number; vodFollowupScheduleErrors: number }> {
    const cm = getConfigManager();
    const manager = cm.twitchManager as unknown as {
        getAllStreams: () => Promise<TwitchStreamConfigPlain[]>;
        upsert?: (item: TwitchStreamConfigPlain, fields: string[]) => Promise<unknown>;
    };
    const notifications = cm.notificationsManager as unknown as JobNotificationManager;

    const streams = (await manager.getAllStreams()).filter(cfg => !cfg.paused);
    if (!streams.length) return { processed: 0, errors: 0, vodFollowupsScheduled: 0, vodFollowupScheduleErrors: 0 };

    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    let token: string;
    try {
        token = await getTwitchAppToken();
    } catch (err) {
        await Promise.all(streams.map(cfg => recordIntegrationFailure('twitch', cfg, err, {
            errorCode: 'TWITCH_AUTH_FAILED',
            metadata: { username: cfg.twitchUsername },
        })));
        throw err;
    }

    // Resolve users by login and streams by user id in batches
    const logins = streams.map(s => s.twitchUsername).filter(Boolean);
    const users = await helixGetUsersByLogin(token, clientId, logins);
    const idByLogin = new Map(users.map(u => [u.login.toLowerCase(), u.id] as const));
    const streamsByUser = await helixGetStreamsByUserIds(token, clientId, users.map(u => u.id));
    const streamByUserId = new Map(streamsByUser.map(s => [s.user_id, s] as const));
    const gameIds = streamsByUser.map(s => s.game_id).filter((g): g is string => typeof g === 'string');
    const gameNameById = await helixGetGamesByIds(token, clientId, gameIds);

    let processed = 0; let errors = 0; let vodFollowupsScheduled = 0; let vodFollowupScheduleErrors = 0;

    for (const cfg of streams) {
        try {
            const userId = idByLogin.get(normalizeTwitchLogin(cfg.twitchUsername));
            if (!userId) {
                errors += 1;
                await recordIntegrationFailure('twitch', cfg, new Error(`Twitch user not found: ${cfg.twitchUsername}`), {
                    errorCode: 'TWITCH_USER_NOT_FOUND',
                    metadata: { username: cfg.twitchUsername },
                });
                continue;
            }
            const stream = streamByUserId.get(userId) ?? null;
            const isLive = stream !== null && stream !== undefined;
            const wasLive = Boolean(cfg.isLive);
            const user = users.find(u => u.id === userId);
            if (!user) {
                errors += 1;
                await recordIntegrationFailure('twitch', cfg, new Error(`Twitch user not found: ${cfg.twitchUsername}`), {
                    errorCode: 'TWITCH_USER_NOT_FOUND',
                    metadata: { username: cfg.twitchUsername },
                });
                continue;
            }

            const sent = await syncLiveNotificationState({
                config: cfg,
                manager,
                notifications,
                provider: 'twitch',
                eventId: stream?.id ?? '',
                isLive,
                buildPayload: () => {
                    const gameName = stream?.game_id ? (gameNameById.get(stream.game_id) ?? null) : null;
                    return buildTwitchEmbedAndContent({ user, stream: stream!, gameName, customMessage: cfg.customMessage ?? null }).payload;
                },
            });
            if (wasLive && !isLive && shouldScheduleVodFollowup(cfg)) {
                try {
                    if (options.scheduleVodFollowup) {
                        await options.scheduleVodFollowup(cfg, user);
                        vodFollowupsScheduled += 1;
                    }
                } catch (err) {
                    vodFollowupScheduleErrors += 1;
                    throw err;
                }
            }
            if (sent) {
                processed += 1;
            }
            await recordIntegrationSuccess('twitch', cfg, {
                delivered: sent,
                metadata: {
                    username: cfg.twitchUsername,
                    isLive,
                    eventId: stream?.id ?? null,
                },
            });
        } catch (err) {
            errors += 1;
            await recordIntegrationFailure('twitch', cfg, err, {
                metadata: { username: cfg.twitchUsername },
            });
            log.error({ err, username: cfg.twitchUsername }, 'Error processing Twitch config');
        }
    }

    return { processed, errors, vodFollowupsScheduled, vodFollowupScheduleErrors };
}

function shouldScheduleVodFollowup(config: TwitchStreamConfigPlain): boolean {
    return config.vodFollowupEnabled === true && config.id !== undefined && config.id !== null;
}

function getVodFollowupDelaySeconds(config: TwitchStreamConfigPlain): number {
    const rawDelay = config.vodFollowupDelayMinutes;
    const minutes = typeof rawDelay === 'number' && Number.isFinite(rawDelay)
        ? Math.max(1, Math.min(1440, Math.floor(rawDelay)))
        : TWITCH_VOD_FOLLOWUP_DEFAULT_DELAY_MINUTES;
    return minutes * 60;
}

async function scheduleTwitchVodFollowup(queue: JobQueue, config: TwitchStreamConfigPlain, user: HelixUser): Promise<void> {
    if (config.id === undefined || config.id === null) return;

    const delaySeconds = getVodFollowupDelaySeconds(config);
    const nextAt = new Date(Date.now() + delaySeconds * 1000);
    await scheduleSingleton(
        queue,
        'twitch:vod-followup',
        {
            configId: config.id,
            twitchUserId: user.id,
            twitchUsername: user.login,
            twitchDisplayName: user.display_name,
            profileImageUrl: user.profile_image_url,
        } satisfies TwitchVodFollowupJobData,
        delaySeconds,
        `twitch:vod-followup:${config.id}:${user.id}:${formatMinuteKey(nextAt)}`,
    );
}

async function processTwitchVodFollowup(
    data: TwitchVodFollowupJobData,
    log = getLogger({ name: 'api:jobs:twitch' }),
): Promise<TwitchVodFollowupResult> {
    const cm = getConfigManager();
    const manager = cm.twitchManager as unknown as {
        findByPkPlain: (id: string | number) => Promise<TwitchStreamConfigPlain>;
        upsert?: (item: TwitchStreamConfigPlain, fields: string[]) => Promise<unknown>;
    };
    const notifications = cm.notificationsManager as unknown as JobNotificationManager;

    let cfg: TwitchStreamConfigPlain;
    try {
        cfg = await manager.findByPkPlain(data.configId);
    } catch {
        return { processed: 0, errors: 0, status: 'config_missing', configId: data.configId, username: data.twitchUsername };
    }

    if (cfg.paused || cfg.vodFollowupEnabled !== true) {
        return { processed: 0, errors: 0, status: 'disabled', configId: cfg.id ?? data.configId, username: cfg.twitchUsername };
    }

    try {
        const clientId = process.env.TWITCH_CLIENT_ID ?? '';
        const token = await getTwitchAppToken();
        let user = buildJobDataUser(data);
        if (!user) {
            const [fetched] = await helixGetUsersByLogin(token, clientId, [cfg.twitchUsername]);
            user = fetched ?? null;
        }
        if (!user) {
            await recordIntegrationFailure('twitch', cfg, new Error(`Twitch user not found: ${cfg.twitchUsername}`), {
                errorCode: 'TWITCH_USER_NOT_FOUND',
                metadata: { username: cfg.twitchUsername, vodFollowup: true },
            });
            return { processed: 0, errors: 1, status: 'user_missing', configId: cfg.id ?? data.configId, username: cfg.twitchUsername };
        }

        const video = await helixGetLatestArchiveVideo(token, clientId, user.id);
        if (!video) {
            await recordIntegrationSuccess('twitch', cfg, {
                delivered: false,
                metadata: { username: cfg.twitchUsername, vodFollowup: true, status: 'no_archive_video' },
            });
            return { processed: 0, errors: 0, status: 'no_archive_video', configId: cfg.id ?? data.configId, username: cfg.twitchUsername };
        }

        const eventId = `vod:${video.id}`;
        if (cfg.lastVodId === video.id) {
            await recordIntegrationSuccess('twitch', cfg, {
                delivered: false,
                metadata: { username: cfg.twitchUsername, vodFollowup: true, status: 'duplicate_last_vod', eventId, vodId: video.id },
            });
            return { processed: 0, errors: 0, status: 'duplicate_last_vod', configId: cfg.id ?? data.configId, username: cfg.twitchUsername, eventId, vodId: video.id };
        }

        const already = await hasRecordedJobNotification(notifications, 'twitch', eventId, cfg.guildId);
        let sent = false;
        if (!already) {
            sent = await sendJobNotification({
                manager: notifications,
                provider: 'twitch',
                eventId,
                channelId: cfg.discordChannelId,
                guildId: cfg.guildId,
                payload: buildTwitchVodEmbedAndContent({ user, video }).payload,
            });
        }

        if (!sent && !already) {
            await recordIntegrationFailure('twitch', cfg, new Error('Twitch VOD notification send returned no Discord message id'), {
                errorCode: 'TWITCH_VOD_SEND_FAILED',
                metadata: { username: cfg.twitchUsername, vodFollowup: true, status: 'send_failed', eventId, vodId: video.id },
            });
            return { processed: 0, errors: 1, status: 'send_failed', configId: cfg.id ?? data.configId, username: cfg.twitchUsername, eventId, vodId: video.id, delivered: false };
        }

        if (sent || already) {
            cfg.lastVodId = video.id;
            await upsertOrSaveJobConfig(manager, cfg);
        }

        await recordIntegrationSuccess('twitch', cfg, {
            delivered: sent,
            metadata: {
                username: cfg.twitchUsername,
                vodFollowup: true,
                status: already ? 'duplicate_notification' : 'notified',
                eventId,
                vodId: video.id,
            },
        });
        return {
            processed: sent ? 1 : 0,
            errors: 0,
            status: already ? 'duplicate_notification' : 'notified',
            configId: cfg.id ?? data.configId,
            username: cfg.twitchUsername,
            eventId,
            vodId: video.id,
            delivered: sent,
        };
    } catch (err) {
        await recordIntegrationFailure('twitch', cfg, err, {
            metadata: { username: cfg.twitchUsername, vodFollowup: true },
        });
        log.error({ err, username: cfg.twitchUsername }, 'Error processing Twitch VOD follow-up');
        return { processed: 0, errors: 1, status: 'error', configId: cfg.id ?? data.configId, username: cfg.twitchUsername };
    }
}

function buildJobDataUser(data: TwitchVodFollowupJobData): HelixUser | null {
    if (!data.twitchUserId || !data.twitchUsername) return null;
    return {
        id: data.twitchUserId,
        login: data.twitchUsername,
        display_name: data.twitchDisplayName,
        profile_image_url: data.profileImageUrl,
    };
}

/**
 * Register Twitch polling job.
 * - Polls every ~60 seconds with singleton scheduling.
 */
export async function registerTwitchJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:twitch' });

    queue.on<TwitchVodFollowupJobData>('twitch:vod-followup', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processTwitchVodFollowup(job.data, log);
            recordJobRun('twitch', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: result.errors === 0,
                meta: { ...result, job: 'vod-followup' },
            });
        } catch (err) {
            recordJobRun('twitch', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        } finally {
            await job.done();
        }
    });

    // Schedule initial and immediate run
    const startupJitter = getTwitchStartupJitterSeconds();
    await registerRecurringPollingJob({
        queue,
        provider: 'twitch',
        jobName: 'twitch:poll',
        intervalSeconds: 60,
        initialDelaySeconds: TWITCH_STARTUP_DEFAULT_DELAY_SECONDS + startupJitter,
        catchupDelaySeconds: startupJitter,
        now,
        run: () => processTwitchPoll(log, {
            scheduleVodFollowup: (config, user) => scheduleTwitchVodFollowup(queue, config, user),
        }),
    });

    log.info('Scheduled Twitch polling job');
}
