import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { TwitchClipConfig, TwitchClipRequest } from '@zeffuro/fakegaming-common/models';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { getClipCommandTitle, matchesClipCommand, type TwitchClipChatMessage } from './chatMessage.js';
import { createTwitchCommandClip, getTwitchCommandClip, getTwitchClipCategory, TwitchClipApiError } from './helix.js';
import { getTwitchClipTargets, reserveTwitchClipRequest } from './requestStore.js';
import { buildTwitchClipPayload } from './clipPayload.js';
import { resolveGuildOutputLocale } from '../localization/locale.js';
import { hasRecordedJobNotification, sendJobNotification } from '../jobs/jobNotifications.js';
import { recordIntegrationFailure, recordIntegrationSuccess } from '../jobs/integrationHealth.js';
import { replyToTwitchClipRequest } from './chatReply.js';
import { getTwitchClipDownload } from './clipDownload.js';

const log = getLogger({ name: 'api:twitch-clips' });

export class TwitchClipProcessor {
    private readonly broadcasterWork = new Map<string, Promise<void>>();
    private readonly deliveryWork = new Map<string, Promise<void>>();

    constructor(private readonly queue: JobQueue) {}

    async receive(message: TwitchClipChatMessage): Promise<void> {
        const key = message.broadcaster_user_id;
        const receivedAt = Date.now();
        const previous = this.broadcasterWork.get(key) ?? Promise.resolve();
        const work = previous.catch(() => undefined).then(async () => {
            if (Date.now() - receivedAt <= 15_000) await this.create(message);
        });
        this.broadcasterWork.set(key, work);
        try { await work; } finally {
            if (this.broadcasterWork.get(key) === work) this.broadcasterWork.delete(key);
        }
    }

    async scheduleDelivery(requestId: string, delay = 2): Promise<void> {
        await this.queue.schedule('twitch-clips:deliver', { requestId }, {
            startAfterSeconds: delay,
            idempotencyKey: `twitch-clips:${requestId}:${Math.floor(Date.now() / 1000)}`,
        });
    }

    async deliver(requestId: string): Promise<void> {
        const active = this.deliveryWork.get(requestId);
        if (active) return active;
        const work = this.processDelivery(requestId);
        this.deliveryWork.set(requestId, work);
        try { await work; } finally { this.deliveryWork.delete(requestId); }
    }

    private async create(message: TwitchClipChatMessage): Promise<void> {
        const configs = (await TwitchClipConfig.findAll({
            where: { broadcasterId: message.broadcaster_user_id, enabled: true },
        })).filter(config => matchesClipCommand(config, message));
        if (configs.length === 0) return;
        const request = await reserveTwitchClipRequest(message, configs);
        if (!request) return;
        try {
            const duration = Math.max(...configs.map(config => config.durationSeconds));
            const title = getClipCommandTitle(message);
            const clipId = await createTwitchCommandClip(request.broadcasterId, duration, title);
            await request.update({ clipId, status: 'ready', clipAcceptedAt: new Date() });
            log.info(this.requestLogContext(request), 'Twitch accepted clip creation');
        } catch (error) {
            const errorCode = error instanceof TwitchClipApiError ? `twitch_http_${error.status}` : 'creation_failed';
            await request.update({ status: 'failed', errorCode });
            await this.recordFailure(configs, errorCode, request);
            await replyToTwitchClipRequest(request, configs, { errorCode });
            return;
        }
        // Failed queue writes remain recoverable from the persisted clip ID.
        await this.scheduleDelivery(request.id);
    }

    private async processDelivery(requestId: string): Promise<void> {
        const request = await TwitchClipRequest.findByPk(requestId);
        if (!request || request.status !== 'ready' || !request.clipId) return;
        const targets = await getTwitchClipTargets(request);
        if (targets.length === 0) {
            await request.update({ status: 'delivered' });
            return;
        }
        const age = Date.now() - new Date(request.requestedAt).getTime();
        if (age > 24 * 60 * 60_000) {
            await request.update({ status: 'failed', errorCode: 'delivery_expired' });
            await this.recordFailure(targets, 'delivery_expired', request);
            return;
        }
        try {
            const clip = await getTwitchCommandClip(request.clipId);
            if (!clip) {
                const pollAge = Date.now() - new Date(request.clipAcceptedAt ?? request.requestedAt).getTime();
                if (pollAge >= 60_000) {
                    await request.update({ status: 'failed', errorCode: 'clip_not_created' });
                    await this.recordFailure(targets, 'clip_not_created', request);
                    await replyToTwitchClipRequest(request, targets, { errorCode: 'clip_not_created' });
                } else {
                    log.debug(this.requestLogContext(request), 'Twitch clip publication pending');
                    await this.scheduleDelivery(request.id, 4);
                }
                return;
            }
            if (clip.broadcaster_id !== request.broadcasterId) throw new Error('Clip broadcaster mismatch');
            await replyToTwitchClipRequest(request, targets, { url: `https://clips.twitch.tv/${clip.id}` });
            [clip.categoryName, clip.downloadUrl] = await Promise.all([
                getTwitchClipCategory(clip.game_id), getTwitchClipDownload(clip.id),
            ]);
            const manager = getConfigManager().notificationsManager;
            const notifications = {
                has: (provider: string, eventId: string) => manager.has(provider, eventId),
                hasForGuild: (provider: string, eventId: string, guildId: string) => manager.hasForGuild(provider, eventId, guildId),
                recordIfNew: async (item: { provider: string; eventId: string; channelId: string; guildId: string }) => {
                    await manager.recordIfNew(item);
                },
            };
            let pending = false;
            for (const config of targets) {
                const eventId = `clip:${clip.id}:${config.id}`;
                if (await hasRecordedJobNotification(notifications, 'twitch', eventId, config.guildId)) continue;
                const locale = await resolveGuildOutputLocale(config.guildId);
                const sent = await sendJobNotification({
                    manager: notifications,
                    provider: 'twitch',
                    eventId,
                    channelId: config.discordChannelId,
                    guildId: config.guildId,
                    payload: buildTwitchClipPayload(clip, request.triggerName, config.id, locale),
                });
                if (!sent) {
                    pending = true;
                    await this.recordFailure([config], 'discord_delivery_failed', request);
                } else {
                    await recordIntegrationSuccess('twitch', config, {
                        delivered: true, metadata: { clips: true, clipId: clip.id, eventId },
                    });
                }
            }
            if (pending) await this.scheduleDelivery(request.id, 30);
            else await request.update({ status: 'delivered', errorCode: null });
        } catch (error) {
            const errorCode = error instanceof TwitchClipApiError ? `twitch_http_${error.status}` : 'delivery_failed';
            await request.update({ errorCode });
            await this.recordFailure(targets, errorCode, request);
            await this.scheduleDelivery(request.id, 30);
        }
    }

    private requestLogContext(request: TwitchClipRequest) {
        return {
            requestId: request.id, clipId: request.clipId, broadcasterId: request.broadcasterId,
            requestedAt: new Date(request.requestedAt),
            clipAcceptedAt: request.clipAcceptedAt ? new Date(request.clipAcceptedAt) : null,
            pollAgeMs: Date.now() - new Date(request.clipAcceptedAt ?? request.requestedAt).getTime(),
        };
    }

    private async recordFailure(configs: TwitchClipConfig[], errorCode: string, request: TwitchClipRequest): Promise<void> {
        log.warn({ errorCode, ...this.requestLogContext(request) }, 'Twitch clip operation failed');
        await Promise.all(configs.map(config => recordIntegrationFailure('twitch', config, new Error(errorCode), {
            errorCode, metadata: { clips: true },
        })));
    }
}
