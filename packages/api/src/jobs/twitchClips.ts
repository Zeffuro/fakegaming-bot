import { getLogger } from '@zeffuro/fakegaming-common';
import { TwitchClipConfig } from '@zeffuro/fakegaming-common/models';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { getTwitchClipBotToken } from '../twitchClips/botAuth.js';
import { TwitchClipChatConnection } from '../twitchClips/chatConnection.js';
import { TwitchClipProcessor } from '../twitchClips/clipProcessor.js';
import { recoverTwitchClipRequests } from '../twitchClips/requestStore.js';
import { setTwitchClipRuntimeStatus } from '../twitchClips/runtimeStatus.js';
import { twitchClipHelix } from '../twitchClips/helix.js';
import { recordJobRun } from './status.js';
import { matchesClipCommand } from '../twitchClips/chatMessage.js';

const log = getLogger({ name: 'api:jobs:twitch-clips' });
let stopRuntime: (() => void) | null = null;

export function stopTwitchClipJobs(): void {
    stopRuntime?.();
    stopRuntime = null;
}

export async function registerTwitchClipJobs(queue: JobQueue): Promise<void> {
    stopTwitchClipJobs();
    const processor = new TwitchClipProcessor(queue);
    let botId: string | null = null;
    let clipConfigs: TwitchClipConfig[] = [];
    const chat = new TwitchClipChatConnection({
        subscribe: async (sessionId, broadcasterId) => {
            const bot = await getTwitchClipBotToken();
            const response = await twitchClipHelix('eventsub/subscriptions', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'channel.chat.message', version: '1',
                    condition: { broadcaster_user_id: broadcasterId, user_id: bot.userId },
                    transport: { method: 'websocket', session_id: sessionId },
                }),
            });
            const result = await response.json() as { data?: { id: string }[] };
            const id = result.data?.[0]?.id;
            if (!id) throw new Error('Twitch returned no chat subscription ID');
            return id;
        },
        unsubscribe: async subscriptionId => {
            const response = await twitchClipHelix(`eventsub/subscriptions?${new URLSearchParams({ id: subscriptionId })}`, {
                method: 'DELETE',
            });
            await response.body?.cancel();
        },
        onMessage: async message => {
            if (message.chatter_user_id !== botId && clipConfigs.some(config => matchesClipCommand(config, message))) {
                await processor.receive(message);
            }
        },
        onStatus: (chatConnected, subscribedChannels, lastErrorCode) => {
            setTwitchClipRuntimeStatus({ chatConnected, subscribedChannels, lastErrorCode });
        },
    });

    queue.on<{ requestId: string }>('twitch-clips:deliver', async job => {
        const startedAt = new Date().toISOString();
        try {
            await processor.deliver(job.data.requestId);
            recordJobRun('twitch-clips', { startedAt, finishedAt: new Date().toISOString(), ok: true });
        } catch {
            log.warn('Twitch clip delivery deferred to recovery');
            recordJobRun('twitch-clips', {
                startedAt, finishedAt: new Date().toISOString(), ok: false, error: 'delivery_deferred',
            });
        } finally { await job.done(); }
    });

    let running = false;
    let stopped = false;
    const reconcile = async () => {
        if (running || stopped) return;
        running = true;
        try {
            const requests = await recoverTwitchClipRequests();
            for (const request of requests) await processor.scheduleDelivery(request.id);
            const configs = await TwitchClipConfig.findAll({ where: { enabled: true } });
            clipConfigs = configs;
            if (configs.length === 0) {
                chat.stop();
                return;
            }
            const channels = [...new Set(configs.map(config => config.broadcasterId))];
            if (channels.length > 100) {
                chat.stop();
                setTwitchClipRuntimeStatus({ lastErrorCode: 'channel_limit' });
                return;
            }
            const bot = await getTwitchClipBotToken();
            if (stopped) return;
            if (botId !== bot.userId) chat.stop();
            botId = bot.userId;
            await chat.setChannels(channels);
        } catch {
            chat.stop();
            setTwitchClipRuntimeStatus({ lastErrorCode: 'bot_connection_unavailable' });
        } finally { running = false; }
    };
    const timer = setInterval(() => { void reconcile(); }, 30_000);
    timer.unref();
    stopRuntime = () => {
        stopped = true;
        clearInterval(timer);
        chat.stop();
    };
    await reconcile();
}
