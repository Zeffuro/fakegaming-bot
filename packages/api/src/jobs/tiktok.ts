import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { formatUptimeShort } from '@zeffuro/fakegaming-common/utils';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { buildDiscordNotificationPayload } from './discordNotificationPayload.js';
import { syncLiveNotificationState, type JobNotificationManager } from './jobNotifications.js';
import { registerRecurringPollingJob } from './recurringPollingJob.js';
import { recordIntegrationFailure, recordIntegrationSuccess } from './integrationHealth.js';

interface TikTokStreamConfigPlain {
    id?: number | string;
    guildId: string;
    discordChannelId: string;
    tiktokUsername: string;
    isLive?: boolean;
    customMessage?: string | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number | null;
    lastNotifiedAt?: string | number | Date | null;
    paused?: boolean | null;
}

interface TikTokLiveInfo {
    live: boolean;
    roomId?: string | null;
    title?: string | null;
    startedAt?: number | null; // ms epoch
    viewers?: number | null;
    cover?: string | null;
    debugMeta?: { method: 'connect' | 'unknown'; raw?: unknown };
}

export interface TikTokSessionDiagnostics {
    cookieConfigured: boolean;
    cookiePairCount: number;
    likelySessionCookiePresent: boolean;
    freshness: 'not-configured' | 'unknown';
    connectorUsesCookie: boolean;
    summary: string;
}

export interface TikTokDebugMeta {
    method: 'connect' | 'unknown';
    fetchStatus: 'live' | 'connect-failed' | 'offline';
    errorCode: string | null;
    cachedOffline: boolean;
    offlineBackoffUntil: string | null;
    checkedAt: string;
    session: TikTokSessionDiagnostics;
}

interface TikTokPollResolveResult {
    info: TikTokLiveInfo;
    cachedOffline: boolean;
    offlineBackoffUntil: number | null;
}

const TIKTOK_OFFLINE_BACKOFF_MS = 2 * 60 * 1000;
const tiktokOfflineBackoff = new Map<string, { until: number; info: TikTokLiveInfo }>();
const likelySessionCookiePattern = /(?:session|sid|ttwid|msToken|passport_csrf_token)/i;

function normalizeTikTokUsername(username: string): string {
    return username.trim().replace(/^@/, '').toLowerCase();
}

export function getTikTokSessionDiagnostics(cookieHeader = process.env.TIKTOK_COOKIE): TikTokSessionDiagnostics {
    const cookieNames = parseCookieNames(cookieHeader);
    const cookieConfigured = cookieNames.length > 0;
    const likelySessionCookiePresent = cookieNames.some(name => likelySessionCookiePattern.test(name));

    return {
        cookieConfigured,
        cookiePairCount: cookieNames.length,
        likelySessionCookiePresent,
        freshness: cookieConfigured ? 'unknown' : 'not-configured',
        connectorUsesCookie: false,
        summary: cookieConfigured
            ? likelySessionCookiePresent
                ? 'TikTok cookie material is configured, but this connector path does not expose expiry age and is not attaching cookies to live checks.'
                : 'TikTok cookie material is configured, but no likely session cookie was detected and this connector path is not attaching cookies to live checks.'
            : 'No TikTok cookie material is configured for this process.',
    };
}

export function buildTikTokDebugMeta(
    info: TikTokLiveInfo,
    options: {
        now?: Date;
        cachedOffline?: boolean;
        offlineBackoffUntil?: number | null;
        cookieHeader?: string;
    } = {},
): TikTokDebugMeta {
    const checkedAt = options.now ?? new Date();
    const offlineBackoffUntil = normalizeTimestampIso(options.offlineBackoffUntil ?? null);
    const errorCode = getTikTokFetchErrorCode(info.debugMeta?.raw);

    return {
        method: info.debugMeta?.method ?? 'unknown',
        fetchStatus: info.live ? 'live' : errorCode ? 'connect-failed' : 'offline',
        errorCode,
        cachedOffline: options.cachedOffline ?? false,
        offlineBackoffUntil,
        checkedAt: checkedAt.toISOString(),
        session: getTikTokSessionDiagnostics(options.cookieHeader),
    };
}

export function buildTikTokHealthMetadata(
    username: string,
    info: TikTokLiveInfo,
    options: {
        eventId?: string | null;
        now?: Date;
        cachedOffline?: boolean;
        offlineBackoffUntil?: number | null;
        cookieHeader?: string;
    } = {},
): Record<string, unknown> {
    const diagnostics = buildTikTokDebugMeta(info, options);
    return {
        username,
        isLive: info.live,
        eventId: options.eventId ?? null,
        lastFetchStatus: diagnostics.fetchStatus,
        lastFetchErrorCode: diagnostics.errorCode,
        lastFetchMethod: diagnostics.method,
        cachedOffline: diagnostics.cachedOffline,
        offlineBackoffUntil: diagnostics.offlineBackoffUntil,
        tiktokSession: diagnostics.session,
    };
}

function parseCookieNames(cookieHeader: string | undefined): string[] {
    const normalized = cookieHeader?.trim().replace(/^cookie:\s*/i, '') ?? '';
    if (!normalized) return [];

    const names = new Set<string>();
    for (const part of normalized.split(';')) {
        const [rawName] = part.trim().split('=');
        const name = rawName?.trim();
        if (name) names.add(name);
    }
    return [...names];
}

function normalizeTimestampIso(value: number | null): string | null {
    if (value === null || !Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getTikTokFetchErrorCode(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    const text = getSafeDiagnosticText(raw);
    if (!text) return 'TIKTOK_CONNECT_FAILED';
    if (/rate.?limit|too many requests|\b429\b/i.test(text)) return 'TIKTOK_RATE_LIMITED';
    if (/auth|login|credential|cookie|session|captcha|forbidden|\b401\b|\b403\b/i.test(text)) return 'TIKTOK_AUTH_REQUIRED';
    if (/not found|unknown user|\b404\b/i.test(text)) return 'TIKTOK_USER_NOT_FOUND';
    if (/timeout|timed out|network|ECONN|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(text)) return 'TIKTOK_NETWORK_ERROR';
    if (/room|offline|not live|live status/i.test(text)) return 'TIKTOK_ROOM_UNAVAILABLE';
    return 'TIKTOK_CONNECT_FAILED';
}

function getSafeDiagnosticText(raw: unknown): string {
    if (raw instanceof Error) return raw.message;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    return '';
}

export async function resolveTikTokLive(username: string, log = getLogger({ name: 'api:jobs:tiktok' }), opts?: { mode?: 'connect' | 'light' }): Promise<TikTokLiveInfo> {
    const mode = opts?.mode ?? 'connect';

    // Build connection options - hard-disable Euler and any external signers; use only built-in free mechanism
    const options: any = {
        fetchRoomInfoOnConnect: true,
        enableExtendedGiftInfo: false,
        disableEulerFallbacks: true,
    };

    // Unauthenticated defaults; optionally with flags above
    const conn = new TikTokLiveConnection(username, options);

    if (mode === 'light') {
        try {
            // Try a fast connect. If it connects, consider live; we won't parse enrichment in light mode.
            await conn.connect();
            try { await conn.disconnect(); } catch { /* ignore */ }
            return { live: true, debugMeta: { method: 'connect' } };
        } catch (err) {
            try { await conn.disconnect(); } catch { /* ignore */ }
            return { live: false, debugMeta: { method: 'unknown', raw: err instanceof Error ? err.message : err } };
        }
    }

    // Normalizes various room shapes to our fields
    const parseRoom = (raw: unknown): { roomId: string | null; title: string | null; startedAt: number | null; viewers: number | null; cover: string | null } => {
        try {
            const info = (raw as any)?.roomInfo ?? (raw as any)?.data ?? raw;
            const room = (info as any)?.room ?? info;
            if (!room || typeof room !== 'object') return { roomId: null, title: null, startedAt: null, viewers: null, cover: null };
            const roomId = typeof (room as any).id === 'string' ? (room as any).id : typeof (room as any).roomId === 'string' ? (room as any).roomId : ((room as any).id || (room as any).roomId ? String((room as any).id ?? (room as any).roomId) : null);
            const title = typeof (room as any).title === 'string' ? (room as any).title : null;
            const createTime = (room as any).create_time ?? (room as any).createTime;
            const startedAt = typeof createTime === 'number' ? createTime * 1000 : typeof createTime === 'string' && /^\d+$/.test(createTime) ? Number(createTime) * 1000 : null;
            const viewerCount = (room as any).user_count ?? (room as any).viewerCount;
            const viewers = typeof viewerCount === 'number' ? viewerCount : typeof viewerCount === 'string' && /^\d+$/.test(viewerCount) ? Number(viewerCount) : null;
            const cover = typeof (room as any).cover === 'string' ? (room as any).cover
                : typeof (room as any).cover_image === 'string' ? (room as any).cover_image
                : typeof (room as any).share_url === 'string' ? (room as any).share_url
                : typeof (room as any).background_image === 'string' ? (room as any).background_image
                : (typeof (room as any).owner === 'object' && typeof (room as any).owner?.avatar_thumb?.url_list?.[0] === 'string') ? (room as any).owner.avatar_thumb.url_list[0]
                : null;
            return { roomId: roomId ?? null, title, startedAt, viewers, cover };
        } catch (err) {
            log.debug({ err }, 'Failed to parse TikTok room info');
            return { roomId: null, title: null, startedAt: null, viewers: null, cover: null };
        }
    };

    try {
        // Single source of truth: connect()
        const state = await conn.connect();
        const parsed = parseRoom((state as any) ?? (conn as any));
        try { await conn.disconnect(); } catch { /* ignore */ }
        return { live: true, ...parsed, debugMeta: { method: 'connect', raw: state } };
    } catch (err) {
        try { await conn.disconnect(); } catch { /* ignore */ }
        return { live: false, debugMeta: { method: 'unknown', raw: err instanceof Error ? err.message : err } };
    }
}

async function resolveTikTokLiveForPoll(username: string, log: ReturnType<typeof getLogger>, nowMs = Date.now()): Promise<TikTokPollResolveResult> {
    const key = normalizeTikTokUsername(username);
    const backoff = tiktokOfflineBackoff.get(key);
    if (backoff && backoff.until > nowMs) {
        return {
            info: backoff.info,
            cachedOffline: true,
            offlineBackoffUntil: backoff.until,
        };
    }

    const info = await resolveTikTokLive(username, log);
    let offlineBackoffUntil: number | null = null;
    if (info.live) {
        tiktokOfflineBackoff.delete(key);
    } else {
        offlineBackoffUntil = nowMs + TIKTOK_OFFLINE_BACKOFF_MS;
        tiktokOfflineBackoff.set(key, { until: offlineBackoffUntil, info });
    }
    return {
        info,
        cachedOffline: false,
        offlineBackoffUntil,
    };
}

function buildTikTokEmbedAndContent(opts: { username: string; info: TikTokLiveInfo; customMessage?: string | null }): { content: string; payload: Record<string, unknown> } {
    const { username, info } = opts;
    const url = `https://www.tiktok.com/@${username}/live`;
    const urlSafe = `<${url}>`;
    const startedAtMs = typeof info.startedAt === 'number' ? info.startedAt : null;
    const uptimeMs = typeof startedAtMs === 'number' ? Math.max(0, Date.now() - startedAtMs) : null;
    const uptimeStr = typeof uptimeMs === 'number' && uptimeMs > 0 ? formatUptimeShort(uptimeMs) : null;

    const embed: Record<string, unknown> = {
        title: `${username} is now live on TikTok!`,
        url,
        description: info.title || 'Live on TikTok!',
        color: 0x010101,
        timestamp: new Date().toISOString(),
    };
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    if (typeof info.viewers === 'number') fields.push({ name: 'Viewers', value: String(info.viewers), inline: true });
    if (uptimeStr) fields.push({ name: 'Uptime', value: uptimeStr, inline: true });
    if (fields.length) (embed as any).fields = fields;
    if (info.cover) (embed as any).image = { url: info.cover };

    const tokens = {
        streamer: username,
        title: info.title || '',
        url: urlSafe,
        uptime: uptimeStr || '',
        viewers: typeof info.viewers === 'number' ? String(info.viewers) : ''
    };
    return buildDiscordNotificationPayload({
        defaultContent: `Hey @everyone, ${username} is now live! ${urlSafe}`,
        embed,
        buttonLabel: 'Watch Stream',
        buttonUrl: url,
        tokens,
        customMessage: opts.customMessage,
        urlToken: urlSafe,
    });
}

async function processTikTokPoll(log: ReturnType<typeof getLogger> = getLogger({ name: 'api:jobs:tiktok' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const manager = cm.tiktokManager as unknown as {
        getAllStreams: () => Promise<TikTokStreamConfigPlain[]>;
        upsert?: (item: TikTokStreamConfigPlain, fields: string[]) => Promise<unknown>;
    };
    const notifications = cm.notificationsManager as unknown as JobNotificationManager;

    const streams = (await manager.getAllStreams()).filter(cfg => !cfg.paused);
    if (!streams.length) return { processed: 0, errors: 0 };

    let processed = 0; let errors = 0;
    const configsByUsername = new Map<string, TikTokStreamConfigPlain[]>();

    for (const cfg of streams) {
        if (!cfg.tiktokUsername || !cfg.discordChannelId) continue;
        const key = normalizeTikTokUsername(cfg.tiktokUsername);
        const group = configsByUsername.get(key) ?? [];
        group.push(cfg);
        configsByUsername.set(key, group);
    }

    const liveInfoByUsername = new Map<string, TikTokPollResolveResult>();
    for (const [username, configs] of configsByUsername) {
        try {
            liveInfoByUsername.set(username, await resolveTikTokLiveForPoll(configs[0].tiktokUsername, log));
        } catch (err) {
            errors += configs.length;
            await Promise.all(configs.map(cfg => recordIntegrationFailure('tiktok', cfg, err, {
                errorCode: 'TIKTOK_RESOLVE_FAILED',
                metadata: {
                    username: cfg.tiktokUsername,
                    lastFetchStatus: 'connect-failed',
                    lastFetchErrorCode: 'TIKTOK_RESOLVE_FAILED',
                    lastFetchMethod: 'unknown',
                    cachedOffline: false,
                    offlineBackoffUntil: null,
                    tiktokSession: getTikTokSessionDiagnostics(),
                },
            })));
            log.error({ err, username }, 'Error resolving TikTok live status');
        }
    }

    for (const cfg of streams) {
        try {
            const username = normalizeTikTokUsername(cfg.tiktokUsername);
            const resolved = liveInfoByUsername.get(username);
            if (!resolved) continue;
            const { info } = resolved;
            const isLive = info.live;
            const now = new Date();
            const eventId = isLive ? String(info.roomId ?? `${cfg.tiktokUsername}:${Math.floor(now.getTime()/60000)}`) : '';

            const sent = await syncLiveNotificationState({
                config: cfg,
                manager,
                notifications,
                provider: 'tiktok',
                eventId,
                isLive,
                now,
                buildPayload: () => buildTikTokEmbedAndContent({ username: cfg.tiktokUsername, info, customMessage: cfg.customMessage ?? null }).payload,
            });
            if (sent) {
                processed += 1;
            }
            await recordIntegrationSuccess('tiktok', cfg, {
                delivered: sent,
                metadata: buildTikTokHealthMetadata(cfg.tiktokUsername, info, {
                    eventId,
                    now,
                    cachedOffline: resolved.cachedOffline,
                    offlineBackoffUntil: resolved.offlineBackoffUntil,
                }),
            });
        } catch (err) {
            errors += 1;
            await recordIntegrationFailure('tiktok', cfg, err, {
                metadata: {
                    username: cfg.tiktokUsername,
                    lastFetchStatus: 'connect-failed',
                    lastFetchErrorCode: 'TIKTOK_PROCESS_FAILED',
                    lastFetchMethod: 'unknown',
                    cachedOffline: false,
                    offlineBackoffUntil: null,
                    tiktokSession: getTikTokSessionDiagnostics(),
                },
            });
            log.error({ err, username: cfg.tiktokUsername }, 'Error processing TikTok config');
        }
    }

    return { processed, errors };
}

export async function registerTikTokJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:tiktok' });

    await registerRecurringPollingJob({
        queue,
        provider: 'tiktok',
        jobName: 'tiktok:poll',
        intervalSeconds: 900,
        initialDelaySeconds: 7,
        now,
        run: () => processTikTokPoll(log),
    });

    log.info('Scheduled TikTok polling job');
}
