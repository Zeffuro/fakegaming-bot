import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, formatMinuteKey } from '@zeffuro/fakegaming-common/jobs';
import { isWithinQuietHours, toMillis } from '@zeffuro/fakegaming-common/utils';
import { renderTemplate } from '@zeffuro/fakegaming-common/utils';
import { formatUptimeShort } from '@zeffuro/fakegaming-common/utils';
import { sendChannelMessagePayload } from '../utils/discord.js';
import { recordJobRun } from './status.js';
import { TikTokLiveConnection } from 'tiktok-live-connector';

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
    let content = `Hey @everyone, ${username} is now live! ${urlSafe}`;
    if (opts.customMessage) {
        const tmpl = String(opts.customMessage);
        content = renderTemplate(tmpl, tokens);
        if (!tmpl.includes('{url}')) content = `${content}\n${urlSafe}`;
    }

    return { content, payload: { content, embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Watch Stream', url }] }] } };
}

async function processTikTokPoll(log: ReturnType<typeof getLogger> = getLogger({ name: 'api:jobs:tiktok' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const manager = cm.tiktokManager as unknown as { getAllStreams: () => Promise<TikTokStreamConfigPlain[]> };
    const notifications = cm.notificationsManager as unknown as { has: (p: string, id: string) => Promise<boolean>; recordIfNew: (x: { provider: string; eventId: string; channelId: string; guildId: string }) => Promise<void> };

    const streams = await manager.getAllStreams();
    if (!streams.length) return { processed: 0, errors: 0 };

    let processed = 0; let errors = 0;

    for (const cfg of streams) {
        try {
            const info = await resolveTikTokLive(cfg.tiktokUsername, log);
            const isLive = info.live;

            if (isLive && !cfg.isLive) {
                const now = new Date();
                const eventId = String(info.roomId ?? `${cfg.tiktokUsername}:${Math.floor(now.getTime()/60000)}`);
                const already = await notifications.has('tiktok', eventId);
                const suppressedByQuiet = isWithinQuietHours(cfg.quietHoursStart ?? null, cfg.quietHoursEnd ?? null, now);
                const lastNotifiedDate = cfg.lastNotifiedAt ? new Date(toMillis(cfg.lastNotifiedAt)) : null;
                const cooldown = typeof cfg.cooldownMinutes === 'number' && cfg.cooldownMinutes > 0 && lastNotifiedDate
                    ? (now.getTime() - lastNotifiedDate.getTime()) < cfg.cooldownMinutes * 60_000
                    : false;
                if (!already && !suppressedByQuiet && !cooldown) {
                    const built = buildTikTokEmbedAndContent({ username: cfg.tiktokUsername, info, customMessage: cfg.customMessage ?? null });
                    const sent = await sendChannelMessagePayload(cfg.discordChannelId, built.payload);
                    if (sent && typeof (sent as any).id === 'string') {
                        (cfg as any).lastNotifiedAt = now;
                        processed += 1;
                        await notifications.recordIfNew({ provider: 'tiktok', eventId, channelId: cfg.discordChannelId, guildId: cfg.guildId });
                    }
                }
                (cfg as any).isLive = true;
                await (cm.tiktokManager as any).upsert?.(cfg, ['id'])?.catch(async () => { await (cfg as any).save?.(); });
            } else if (!isLive && cfg.isLive) {
                (cfg as any).isLive = false;
                await (cm.tiktokManager as any).upsert?.(cfg, ['id'])?.catch(async () => { await (cfg as any).save?.(); });
            }
        } catch (err) {
            errors += 1;
            log.error({ err, username: cfg.tiktokUsername }, 'Error processing TikTok config');
        }
    }

    return { processed, errors };
}

export async function registerTikTokJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:tiktok' });

    queue.on('tiktok:poll', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await processTikTokPoll(log);
            const delaySec = 900; // 15 minutes
            const nextAt = new Date(Date.now() + delaySec * 1000);
            const key = `tiktok:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(queue, 'tiktok:poll', {}, delaySec, key);
            recordJobRun('tiktok', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('tiktok', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const initDelay = 7;
    await scheduleSingleton(queue, 'tiktok:poll', {}, initDelay, `tiktok:init:${formatMinuteKey(new Date(now.getTime() + initDelay * 1000))}`);
    await scheduleSingleton(queue, 'tiktok:poll', {}, 0, `tiktok:catchup:${formatMinuteKey(now)}`);

    log.info('Scheduled TikTok polling job');
}
