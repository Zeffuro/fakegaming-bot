import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitchClipConfig } from '@zeffuro/fakegaming-common/models';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { getTwitchClipBotToken } from '../../twitchClips/botAuth.js';
import { recoverTwitchClipRequests } from '../../twitchClips/requestStore.js';
import { twitchClipHelix } from '../../twitchClips/helix.js';
import { getTwitchClipRuntimeStatus } from '../../twitchClips/runtimeStatus.js';
import { recordJobRun } from '../status.js';
import { registerTwitchClipJobs, stopTwitchClipJobs } from '../twitchClips.js';

const mocks = vi.hoisted(() => ({
    receive: vi.fn(), deliver: vi.fn(), scheduleDelivery: vi.fn(),
    setChannels: vi.fn(), stop: vi.fn(),
    options: null as null | {
        subscribe: (session: string, channel: string) => Promise<string>;
        unsubscribe: (id: string) => Promise<void>;
        onMessage: (message: unknown) => Promise<void>;
        onStatus: (connected: boolean, count: number, error: string | null) => void;
    },
}));
vi.mock('../../twitchClips/chatConnection.js', () => ({
    TwitchClipChatConnection: class {
        constructor(options: NonNullable<typeof mocks.options>) { mocks.options = options; }
        setChannels = mocks.setChannels;
        stop = mocks.stop;
    },
}));
vi.mock('../../twitchClips/clipProcessor.js', () => ({
    TwitchClipProcessor: class {
        receive = mocks.receive;
        deliver = mocks.deliver;
        scheduleDelivery = mocks.scheduleDelivery;
    },
}));
vi.mock('../../twitchClips/botAuth.js', () => ({ getTwitchClipBotToken: vi.fn() }));
vi.mock('../../twitchClips/requestStore.js', () => ({ recoverTwitchClipRequests: vi.fn() }));
vi.mock('../../twitchClips/helix.js', () => ({ twitchClipHelix: vi.fn() }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

beforeEach(async () => {
    await TwitchClipConfig.destroy({ where: {} });
    vi.mocked(getTwitchClipBotToken).mockResolvedValue({ accessToken: 'token', userId: 'bot', login: 'fakegamingbot' });
    vi.mocked(recoverTwitchClipRequests).mockResolvedValue([]);
    vi.useFakeTimers();
});
afterEach(() => { stopTwitchClipJobs(); vi.useRealTimers(); });

async function config(guildId = 'guild-a', broadcasterId = '123') {
    return TwitchClipConfig.create({ guildId, broadcasterId, twitchUsername: `streamer${broadcasterId}`, discordChannelId: 'destination' });
}

describe('clip listener job integration', () => {
    it('recovers delivery even without channels and avoids opening an unused Twitch connection', async () => {
        vi.mocked(recoverTwitchClipRequests).mockResolvedValueOnce([{ id: 'ready-request' }] as Awaited<ReturnType<typeof recoverTwitchClipRequests>>);
        await registerTwitchClipJobs(new TestJobQueue());
        expect(mocks.scheduleDelivery).toHaveBeenCalledWith('ready-request');
        expect(getTwitchClipBotToken).not.toHaveBeenCalled();
        expect(mocks.setChannels).not.toHaveBeenCalled();
    });

    it('shares channel subscriptions and filters ordinary chat, its own commands and disallowed access', async () => {
        await config();
        await config('guild-b');
        await registerTwitchClipJobs(new TestJobQueue());
        expect(mocks.setChannels).toHaveBeenCalledExactlyOnceWith(['123']);
        const event = {
            broadcaster_user_id: '123', broadcaster_user_name: 'Streamer', chatter_user_id: 'viewer',
            chatter_user_name: 'Viewer', message_id: 'message', message: { text: '!clip' }, badges: [],
        };
        await mocks.options!.onMessage({ ...event, message: { text: 'normal conversation' } });
        await mocks.options!.onMessage({ ...event, chatter_user_id: 'bot' });
        await mocks.options!.onMessage(event);
        expect(mocks.receive).toHaveBeenCalledExactlyOnceWith(event);
        await TwitchClipConfig.update({ permission: 'owner' }, { where: {} });
        await vi.advanceTimersByTimeAsync(30_000);
        await vi.waitFor(() => expect(mocks.setChannels).toHaveBeenCalledTimes(2));
        await mocks.options!.onMessage(event);
        expect(mocks.receive).toHaveBeenCalledOnce();
    });

    it('constructs user-token WebSocket subscriptions and surfaces listener state', async () => {
        await config();
        await registerTwitchClipJobs(new TestJobQueue());
        vi.mocked(twitchClipHelix).mockResolvedValueOnce(Response.json({ data: [{ id: 'subscription' }] }));
        expect(await mocks.options!.subscribe('session', '123')).toBe('subscription');
        expect(twitchClipHelix).toHaveBeenCalledWith('eventsub/subscriptions', {
            method: 'POST', body: JSON.stringify({ type: 'channel.chat.message', version: '1',
                condition: { broadcaster_user_id: '123', user_id: 'bot' }, transport: { method: 'websocket', session_id: 'session' } }),
        });
        vi.mocked(twitchClipHelix).mockResolvedValueOnce(Response.json({ data: [] }));
        await expect(mocks.options!.subscribe('session', '123')).rejects.toThrow('subscription ID');
        vi.mocked(twitchClipHelix).mockResolvedValueOnce(new Response(null, { status: 204 }));
        await mocks.options!.unsubscribe('subscription');
        expect(twitchClipHelix).toHaveBeenLastCalledWith('eventsub/subscriptions?id=subscription', { method: 'DELETE' });
        mocks.options!.onStatus(true, 1, null);
        expect(getTwitchClipRuntimeStatus()).toMatchObject({ chatConnected: true, subscribedChannels: 1, lastErrorCode: null });
    });

    it('stops on lost authorization, retries later, and cancels reconciliation on shutdown', async () => {
        await config();
        vi.mocked(getTwitchClipBotToken).mockRejectedValueOnce(new Error('revoked'));
        await registerTwitchClipJobs(new TestJobQueue());
        expect(mocks.setChannels).not.toHaveBeenCalled();
        expect(getTwitchClipRuntimeStatus().lastErrorCode).toBe('bot_connection_unavailable');
        await vi.advanceTimersByTimeAsync(30_000);
        await vi.waitFor(() => expect(mocks.setChannels).toHaveBeenCalledWith(['123']));
        stopTwitchClipJobs();
        const calls = vi.mocked(getTwitchClipBotToken).mock.calls.length;
        await vi.advanceTimersByTimeAsync(90_000);
        expect(getTwitchClipBotToken).toHaveBeenCalledTimes(calls);
    });

    it('rejects an oversized channel set rather than subscribing an arbitrary subset', async () => {
        await TwitchClipConfig.bulkCreate(Array.from({ length: 101 }, (_, i) => ({
            guildId: 'guild-a', broadcasterId: String(i), twitchUsername: `streamer${i}`, discordChannelId: 'destination',
        })));
        await registerTwitchClipJobs(new TestJobQueue());
        expect(mocks.setChannels).not.toHaveBeenCalled();
        expect(getTwitchClipRuntimeStatus().lastErrorCode).toBe('channel_limit');
    });

    it('acknowledges failed deliveries while leaving durable requests for recovery', async () => {
        const queue = new TestJobQueue();
        await registerTwitchClipJobs(queue);
        mocks.deliver.mockRejectedValueOnce(new Error('storage unavailable'));
        const { done } = await runJobHandler(queue, 'twitch-clips:deliver', { requestId: 'ready' });
        expect(mocks.deliver).toHaveBeenCalledWith('ready');
        expect(done).toHaveBeenCalledOnce();
        expect(recordJobRun).toHaveBeenLastCalledWith('twitch-clips', expect.objectContaining({ ok: false, error: 'delivery_deferred' }));
        await runJobHandler(queue, 'twitch-clips:deliver', { requestId: 'ready' });
        expect(recordJobRun).toHaveBeenLastCalledWith('twitch-clips', expect.objectContaining({ ok: true }));
    });
});
