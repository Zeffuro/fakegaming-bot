import { getAniListNextAiring, mapAniListTitleToInput, type AniListAiringScheduleItem } from '@zeffuro/fakegaming-common/anime';
import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, formatMinuteKey } from '@zeffuro/fakegaming-common/jobs';
import type { AnimeSubscriptionConfig } from '@zeffuro/fakegaming-common/models';
import type { CreationAttributes } from 'sequelize';
import { sendChannelMessagePayload, sendDirectMessagePayload } from '../utils/discord.js';
import { recordJobRun } from './status.js';

function computeNextAnimeDelaySeconds(now: Date = new Date(), minSeconds = 30): number {
    const ms = now.getTime();
    const target = new Date(ms);
    target.setSeconds(0, 0);
    target.setMinutes(target.getMinutes() + 5);
    const diffSec = Math.floor((target.getTime() - ms) / 1000);
    return Math.max(minSeconds, diffSec);
}

function animeTitle(item: AniListAiringScheduleItem): string {
    const title = item.media?.title;
    return title?.english || title?.romaji || title?.native || `AniList #${item.mediaId}`;
}

function buildAnimeReminderPayload(item: AniListAiringScheduleItem): Record<string, unknown> {
    const airingMs = item.airingAt * 1000;
    const timestamp = new Date(airingMs).toISOString();
    const title = animeTitle(item);
    const embed: Record<string, unknown> = {
        title: `${title} episode ${item.episode}`,
        url: item.media?.siteUrl ?? `https://anilist.co/anime/${item.mediaId}`,
        description: `Episode ${item.episode} airs <t:${item.airingAt}:R>.`,
        timestamp,
        color: 0x02A9FF,
        author: { name: 'Anime reminder' },
    };
    if (item.media?.coverImage?.large) embed.thumbnail = { url: item.media.coverImage.large };
    if (item.media?.bannerImage) embed.image = { url: item.media.bannerImage };
    return { embeds: [embed] };
}

async function sendReminder(subscription: CreationAttributes<AnimeSubscriptionConfig>, item: AniListAiringScheduleItem): Promise<boolean> {
    const payload = buildAnimeReminderPayload(item);
    if (subscription.targetType === 'channel' && subscription.channelId) {
        const sent = await sendChannelMessagePayload(subscription.channelId, payload);
        return Boolean(sent && typeof (sent as { id?: unknown }).id === 'string');
    }
    if (subscription.targetType === 'dm' && subscription.userId) {
        const sent = await sendDirectMessagePayload(subscription.userId, payload);
        return Boolean(sent && typeof (sent as { id?: unknown }).id === 'string');
    }
    return false;
}

async function processAnimeNotifications(log = getLogger({ name: 'api:jobs:anime' })): Promise<{ processed: number; errors: number; checked: number; removedFinished: number }> {
    const cm = getConfigManager();
    const subscriptions = await cm.animeManager.subscriptions.getAllPlain();
    const mediaIds = Array.from(new Set(subscriptions.map((sub) => sub.anilistId)));
    const schedules = await getAniListNextAiring(mediaIds);
    const byMediaId = new Map<number, AniListAiringScheduleItem>();
    for (const item of schedules) {
        if (!byMediaId.has(item.mediaId)) byMediaId.set(item.mediaId, item);
        if (item.media) {
            await cm.animeManager.titles.upsertTitle(mapAniListTitleToInput(item.media));
        }
        await cm.animeManager.episodes.upsertEpisode({
            anilistId: item.mediaId,
            episode: item.episode,
            airingAt: item.airingAt * 1000,
        });
    }

    const now = Date.now();
    let processed = 0;
    let errors = 0;
    let removedFinished = 0;

    for (const subscription of subscriptions) {
        const item = byMediaId.get(subscription.anilistId);
        if (!item) {
            const title = await cm.animeManager.titles.getOnePlain({ anilistId: subscription.anilistId });
            if (subscription.id && (title?.status === 'FINISHED' || title?.status === 'CANCELLED')) {
                await cm.animeManager.subscriptions.removeByPk(subscription.id);
                removedFinished += 1;
                log.info({ subscriptionId: subscription.id, anilistId: subscription.anilistId, status: title.status }, 'Removed completed anime subscription');
            }
            continue;
        }
        const airingMs = item.airingAt * 1000;
        const reminderMs = (subscription.reminderMinutes ?? 30) * 60 * 1000;
        const shouldNotify = now >= airingMs - reminderMs;
        const alreadyNotified = Number(subscription.lastNotifiedEpisode ?? 0) === item.episode
            && Number(subscription.lastNotifiedAiringAt ?? 0) === airingMs;
        if (!shouldNotify || alreadyNotified) continue;

        const sent = await sendReminder(subscription, item);
        if (!sent) {
            errors += 1;
            log.warn({ subscriptionId: subscription.id, anilistId: subscription.anilistId }, 'Failed to send anime reminder');
            continue;
        }

        await cm.animeManager.subscriptions.updatePlain({
            ...subscription,
            lastNotifiedEpisode: item.episode,
            lastNotifiedAiringAt: airingMs,
        }, { id: subscription.id });
        processed += 1;
    }

    return { processed, errors, checked: subscriptions.length, removedFinished };
}

export async function registerAnimeJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:anime' });

    queue.on('anime:notifications', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processAnimeNotifications(log);
            const delay = computeNextAnimeDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            await scheduleSingleton(queue, 'anime:notifications', {}, delay, `anime:notifications:${formatMinuteKey(nextAt)}`);
            recordJobRun('anime-notifications', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: result.errors === 0,
                meta: result,
            });
        } catch (err) {
            recordJobRun('anime-notifications', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        } finally {
            await job.done();
        }
    });

    const initialDelay = computeNextAnimeDelaySeconds(now);
    const initialAt = new Date(now.getTime() + initialDelay * 1000);
    await scheduleSingleton(queue, 'anime:notifications', {}, initialDelay, `anime:notifications:init:${formatMinuteKey(initialAt)}`);
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled anime notification job');
}
