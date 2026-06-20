import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { formatMinuteKey, scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { renderTemplate } from '@zeffuro/fakegaming-common/utils';
import { sendChannelMessagePayload } from '../utils/discord.js';
import { recordJobRun } from './status.js';
import { getNotificationSuppression } from './notificationSuppression.js';

const BLUESKY_APPVIEW = 'https://public.api.bsky.app';

interface BlueskyPostConfigPlain {
    id?: number | string;
    guildId: string;
    discordChannelId: string;
    blueskyHandle: string;
    lastPostUri?: string | null;
    lastPostCid?: string | null;
    customMessage?: string | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number | null;
    lastNotifiedAt?: string | number | Date | null;
}

interface BlueskyActorProfile {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
}

interface BlueskyPostView {
    uri: string;
    cid: string;
    author: BlueskyActorProfile;
    record?: unknown;
    embed?: unknown;
    indexedAt?: string;
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    quoteCount?: number;
}

interface BlueskyFeedEntry {
    post?: unknown;
    reason?: unknown;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null;
}

function firstString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function normalizeBlueskyHandle(input: string): string {
    let value = input.trim();
    value = value.replace(/^https?:\/\/bsky\.app\/profile\//i, '');
    value = value.replace(/^bsky\.app\/profile\//i, '');
    value = value.replace(/^@/, '');
    value = value.split(/[/?#]/u)[0] ?? value;
    return value.trim().toLowerCase();
}

function getPostRecord(post: BlueskyPostView): JsonRecord | null {
    return isRecord(post.record) ? post.record : null;
}

function getPostText(post: BlueskyPostView): string {
    const record = getPostRecord(post);
    return firstString(record?.text) ?? '';
}

function getPostCreatedAt(post: BlueskyPostView): string {
    const record = getPostRecord(post);
    return firstString(record?.createdAt, post.indexedAt) ?? new Date().toISOString();
}

function getPostRkey(uri: string): string | null {
    const parts = uri.split('/');
    return parts.length > 0 ? (parts.at(-1) ?? null) : null;
}

function getPostUrl(post: BlueskyPostView): string {
    const rkey = getPostRkey(post.uri);
    if (!rkey) return `https://bsky.app/profile/${encodeURIComponent(post.author.handle)}`;
    return `https://bsky.app/profile/${encodeURIComponent(post.author.handle)}/post/${encodeURIComponent(rkey)}`;
}

function getProfileUrl(handle: string): string {
    return `https://bsky.app/profile/${encodeURIComponent(handle)}`;
}

function getImageFromEmbed(embed: unknown): string | null {
    if (!isRecord(embed)) return null;

    const images = Array.isArray(embed.images) ? embed.images : Array.isArray(embed.items) ? embed.items : null;
    if (images) {
        for (const image of images) {
            if (!isRecord(image)) continue;
            const url = firstString(image.fullsize, image.thumbnail, image.thumb);
            if (url) return url;
        }
    }

    if (isRecord(embed.external)) {
        const externalUrl = firstString(embed.external.thumb);
        if (externalUrl) return externalUrl;
    }

    if (isRecord(embed.media)) {
        return getImageFromEmbed(embed.media);
    }

    return null;
}

function isRepost(entry: BlueskyFeedEntry): boolean {
    if (!isRecord(entry.reason)) return false;
    return entry.reason.$type === 'app.bsky.feed.defs#reasonRepost';
}

function parsePostView(value: unknown): BlueskyPostView | null {
    if (!isRecord(value)) return null;
    if (typeof value.uri !== 'string' || typeof value.cid !== 'string') return null;
    if (!isRecord(value.author)) return null;
    const handle = firstString(value.author.handle);
    const did = firstString(value.author.did);
    if (!handle || !did) return null;

    return {
        uri: value.uri,
        cid: value.cid,
        author: {
            did,
            handle,
            ...(typeof value.author.displayName === 'string' ? { displayName: value.author.displayName } : {}),
            ...(typeof value.author.avatar === 'string' ? { avatar: value.author.avatar } : {}),
        },
        ...(typeof value.indexedAt === 'string' ? { indexedAt: value.indexedAt } : {}),
        ...(typeof value.replyCount === 'number' ? { replyCount: value.replyCount } : {}),
        ...(typeof value.repostCount === 'number' ? { repostCount: value.repostCount } : {}),
        ...(typeof value.likeCount === 'number' ? { likeCount: value.likeCount } : {}),
        ...(typeof value.quoteCount === 'number' ? { quoteCount: value.quoteCount } : {}),
        record: value.record,
        embed: value.embed,
    };
}

async function fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
        headers: {
            'user-agent': 'fakegaming-bot/1.0',
            'accept': 'application/json',
        },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Bluesky request failed: ${res.status} ${body.slice(0, 256)}`);
    }
    return await res.json();
}

export async function fetchBlueskyProfile(handle: string): Promise<BlueskyActorProfile | null> {
    const normalized = normalizeBlueskyHandle(handle);
    if (!normalized) return null;
    const url = `${BLUESKY_APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(normalized)}`;
    const json = await fetchJson(url);
    if (!isRecord(json)) return null;
    const did = firstString(json.did);
    const profileHandle = firstString(json.handle);
    if (!did || !profileHandle) return null;
    return {
        did,
        handle: profileHandle,
        ...(typeof json.displayName === 'string' ? { displayName: json.displayName } : {}),
        ...(typeof json.avatar === 'string' ? { avatar: json.avatar } : {}),
    };
}

export async function fetchBlueskyAuthorPosts(handle: string, log = getLogger({ name: 'api:jobs:bluesky' }), limit = 5): Promise<BlueskyPostView[] | null> {
    const normalized = normalizeBlueskyHandle(handle);
    if (!normalized) return null;
    const params = new URLSearchParams({
        actor: normalized,
        limit: String(limit),
        filter: 'posts_no_replies',
        includePins: 'false',
    });
    const url = `${BLUESKY_APPVIEW}/xrpc/app.bsky.feed.getAuthorFeed?${params.toString()}`;

    try {
        const json = await fetchJson(url);
        const feed = isRecord(json) && Array.isArray(json.feed) ? json.feed : [];
        const posts: BlueskyPostView[] = [];
        for (const rawEntry of feed) {
            if (!isRecord(rawEntry)) continue;
            const entry = rawEntry as BlueskyFeedEntry;
            if (isRepost(entry)) continue;
            const post = parsePostView(entry.post);
            if (post) posts.push(post);
        }
        return posts;
    } catch (err) {
        log.warn({ err, handle: normalized }, 'Failed to fetch Bluesky author feed');
        return null;
    }
}

function buildBlueskyEmbedAndContent(opts: { post: BlueskyPostView; customMessage?: string | null }): { content: string; payload: Record<string, unknown> } {
    const { post } = opts;
    const authorName = post.author.displayName || post.author.handle;
    const url = getPostUrl(post);
    const urlSafe = `<${url}>`;
    const text = getPostText(post);
    const imageUrl = getImageFromEmbed(post.embed);

    const embed: Record<string, unknown> = {
        title: `${authorName} posted on Bluesky`,
        url,
        author: {
            name: authorName,
            icon_url: post.author.avatar,
            url: getProfileUrl(post.author.handle),
        },
        description: text ? truncate(text, 4000) : 'New post on Bluesky',
        color: 0x1185fe,
        timestamp: getPostCreatedAt(post),
    };

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    if (typeof post.likeCount === 'number') fields.push({ name: 'Likes', value: String(post.likeCount), inline: true });
    if (typeof post.repostCount === 'number') fields.push({ name: 'Reposts', value: String(post.repostCount), inline: true });
    if (typeof post.replyCount === 'number') fields.push({ name: 'Replies', value: String(post.replyCount), inline: true });
    if (fields.length > 0) embed.fields = fields;
    if (imageUrl) embed.image = { url: imageUrl };

    const tokens = {
        author: authorName,
        handle: post.author.handle,
        text,
        url: urlSafe,
        likes: typeof post.likeCount === 'number' ? String(post.likeCount) : '',
        reposts: typeof post.repostCount === 'number' ? String(post.repostCount) : '',
        replies: typeof post.replyCount === 'number' ? String(post.replyCount) : '',
    };

    let content = `Hey @everyone, new Bluesky post from ${authorName}: ${urlSafe}`;
    if (opts.customMessage) {
        const tmpl = String(opts.customMessage);
        content = renderTemplate(tmpl, tokens);
        if (!tmpl.includes('{url}')) content = `${content}\n${urlSafe}`;
    }

    return {
        content,
        payload: {
            content,
            embeds: [embed],
            components: [{ type: 1, components: [{ type: 2, style: 5, label: 'View Post', url }] }],
        },
    };
}

async function persistConfig(cm: ReturnType<typeof getConfigManager>, cfg: BlueskyPostConfigPlain): Promise<void> {
    await (cm.blueskyManager as unknown as { upsert?: (item: BlueskyPostConfigPlain, fields: string[]) => Promise<boolean> })
        .upsert?.(cfg, ['id'])
        ?.catch(async () => { await (cfg as unknown as { save?: () => Promise<void> }).save?.(); });
}

async function processBlueskyPoll(log = getLogger({ name: 'api:jobs:bluesky' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const manager = cm.blueskyManager as unknown as { getAllAccounts: () => Promise<BlueskyPostConfigPlain[]> };
    const notifications = cm.notificationsManager as unknown as {
        has: (provider: string, eventId: string) => Promise<boolean>;
        hasForGuild?: (provider: string, eventId: string, guildId: string) => Promise<boolean>;
        recordIfNew: (item: { provider: string; eventId: string; channelId: string; guildId: string }) => Promise<void>;
    };

    const configs = await manager.getAllAccounts();
    if (!configs.length) return { processed: 0, errors: 0 };

    let processed = 0;
    let errors = 0;

    for (const cfg of configs) {
        try {
            if (!cfg.blueskyHandle || !cfg.discordChannelId) continue;
            const posts = await fetchBlueskyAuthorPosts(cfg.blueskyHandle, log);
            if (!posts || posts.length === 0) continue;

            const latest = posts[0];
            if (!latest) continue;

            let newPosts: BlueskyPostView[];
            if (cfg.lastPostUri) {
                const idxLast = posts.findIndex((post) => post.uri === cfg.lastPostUri);
                newPosts = idxLast === 0 ? [] : idxLast > 0 ? posts.slice(0, idxLast).reverse() : [latest];
            } else {
                newPosts = [latest];
            }

            if (newPosts.length === 0) continue;

            const now = new Date();
            const suppression = getNotificationSuppression(cfg, now);

            let sentAny = false;
            for (const post of newPosts) {
                const eventId = post.uri;
                const already = await notifications.hasForGuild?.('bluesky', eventId, cfg.guildId)
                    ?? await notifications.has('bluesky', eventId);

                if (already || suppression.shouldSuppress) {
                    log.debug({
                        eventId,
                        already,
                        suppressedByQuiet: suppression.suppressedByQuiet,
                        suppressedByCooldown: suppression.suppressedByCooldown,
                    }, 'Suppressing Bluesky post announcement');
                    continue;
                }

                const built = buildBlueskyEmbedAndContent({ post, customMessage: cfg.customMessage ?? null });
                const sent = await sendChannelMessagePayload(cfg.discordChannelId, built.payload);
                if (sent && typeof (sent as { id?: unknown }).id === 'string') {
                    sentAny = true;
                    processed += 1;
                    await notifications.recordIfNew({ provider: 'bluesky', eventId, channelId: cfg.discordChannelId, guildId: cfg.guildId });
                }
            }

            cfg.lastPostUri = latest.uri;
            cfg.lastPostCid = latest.cid;
            if (sentAny) cfg.lastNotifiedAt = now;
            await persistConfig(cm, cfg);
        } catch (err) {
            errors += 1;
            log.error({ err, handle: cfg.blueskyHandle }, 'Error processing Bluesky config');
        }
    }

    return { processed, errors };
}

export async function registerBlueskyJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:bluesky' });

    queue.on('bluesky:poll', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await processBlueskyPoll(log);
            const delaySec = 300;
            const nextAt = new Date(Date.now() + delaySec * 1000);
            const key = `bluesky:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(queue, 'bluesky:poll', {}, delaySec, key);
            recordJobRun('bluesky', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('bluesky', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const initDelay = 9;
    await scheduleSingleton(queue, 'bluesky:poll', {}, initDelay, `bluesky:init:${formatMinuteKey(new Date(now.getTime() + initDelay * 1000))}`);
    await scheduleSingleton(queue, 'bluesky:poll', {}, 0, `bluesky:catchup:${formatMinuteKey(now)}`);

    log.info('Scheduled Bluesky polling job');
}
