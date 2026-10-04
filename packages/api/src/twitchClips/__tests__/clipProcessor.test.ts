import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitchClipConfig, TwitchClipCooldown, TwitchClipRequest } from '@zeffuro/fakegaming-common/models';
import { Notification } from '@zeffuro/fakegaming-common/models';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { TwitchClipProcessor } from '../clipProcessor.js';
import { createTwitchCommandClip, getTwitchCommandClip, TwitchClipApiError } from '../helix.js';
import { sendChannelMessagePayload } from '../../utils/discord.js';
import { reserveTwitchClipRequest, recoverTwitchClipRequests } from '../requestStore.js';
import type { TwitchClipChatMessage } from '../chatMessage.js';

vi.mock('../helix.js', async importOriginal => ({
    ...await importOriginal<typeof import('../helix.js')>(),
    createTwitchCommandClip: vi.fn(), getTwitchCommandClip: vi.fn(),
}));
vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn() }));

const message: TwitchClipChatMessage = {
    broadcaster_user_id: '123', broadcaster_user_name: 'Streamer', chatter_user_id: '456',
    chatter_user_name: '@everyone Viewer', message_id: 'command-id', message: { text: '!clip' }, badges: [],
};
const metadata = {
    id: 'clip-id', url: 'https://clips.twitch.tv/clip-id', title: 'Nice play',
    thumbnail_url: 'https://example.com/thumbnail.jpg', broadcaster_name: 'Streamer', broadcaster_id: '123', duration: 30,
};

async function makeConfig(guildId = 'guild-a', extra: Record<string, unknown> = {}) {
    return TwitchClipConfig.create({
        guildId, broadcasterId: '123', twitchUsername: 'streamer', discordChannelId: `channel-${guildId}`,
        ...extra,
    });
}

function setup() {
    const schedule = vi.fn(async () => 'job-id');
    const queue = { schedule } as unknown as JobQueue;
    return { processor: new TwitchClipProcessor(queue), schedule };
}

beforeEach(async () => {
    await TwitchClipRequest.destroy({ where: {} });
    await TwitchClipCooldown.destroy({ where: {} });
    await TwitchClipConfig.destroy({ where: {} });
    await Notification.destroy({ where: { provider: 'twitch' } });
    vi.mocked(createTwitchCommandClip).mockResolvedValue('clip-id');
    vi.mocked(getTwitchCommandClip).mockResolvedValue(metadata);
    vi.mocked(sendChannelMessagePayload).mockResolvedValue({ id: 'discord-message' });
});

describe('Twitch command clip pipeline', () => {
    it('creates one clip across matching guilds and delivers once per destination with mention suppression', async () => {
        const first = await makeConfig();
        const second = await makeConfig('guild-b', { cooldownSeconds: 60, durationSeconds: 45 });
        const test = setup();
        await Promise.all([test.processor.receive(message), test.processor.receive(message)]);
        expect(createTwitchCommandClip).toHaveBeenCalledExactlyOnceWith('123', 45);
        const row = await TwitchClipRequest.findByPk('command-id');
        expect(row?.clipId).toBe('clip-id');
        expect(row?.status).toBe('ready');
        expect(JSON.parse(row?.targetsJson ?? '[]')).toEqual(expect.arrayContaining([first.id, second.id]));
        await Promise.all([test.processor.deliver('command-id'), test.processor.deliver('command-id')]);
        expect(sendChannelMessagePayload).toHaveBeenCalledTimes(2);
        const payload = vi.mocked(sendChannelMessagePayload).mock.calls[0][1];
        expect(payload).toMatchObject({ content: metadata.url, allowed_mentions: { parse: [] }, enforce_nonce: true });
        expect(JSON.stringify(payload)).toContain('@everyone Viewer');
        expect(await Notification.count({ where: { provider: 'twitch' } })).toBe(2);
        expect((await TwitchClipRequest.findByPk('command-id'))?.status).toBe('delivered');
        await setup().processor.deliver('command-id');
        expect(sendChannelMessagePayload).toHaveBeenCalledTimes(2);
    });

    it('creates only one clip when ten viewers send distinct commands at once', async () => {
        await makeConfig();
        const test = setup();
        await Promise.all(Array.from({ length: 10 }, (_, i) => test.processor.receive({
            ...message, message_id: `burst-${i}`, chatter_user_id: `viewer-${i}`,
        })));
        expect(createTwitchCommandClip).toHaveBeenCalledOnce();
        expect(await TwitchClipRequest.count()).toBe(1);
        expect(test.schedule).toHaveBeenCalledOnce();
    });

    it('persists channel cooldown across processor restarts and aliases', async () => {
        await makeConfig('guild-a', { aliases: ['!moment'] });
        await setup().processor.receive(message);
        await setup().processor.receive({ ...message, message_id: 'next-command', message: { text: '!moment' } });
        expect(createTwitchCommandClip).toHaveBeenCalledTimes(1);
        expect(await TwitchClipRequest.findByPk('next-command')).toBeNull();
        await TwitchClipCooldown.update({ availableAt: new Date(0) }, { where: { broadcasterId: '123' } });
        await setup().processor.receive({ ...message, message_id: 'next-command' });
        expect(createTwitchCommandClip).toHaveBeenCalledTimes(2);
    });

    it('rejects duplicate message IDs even after cooldown and does not consume a new cooldown', async () => {
        const config = await makeConfig();
        const now = new Date();
        const first = await reserveTwitchClipRequest(message, [config], now);
        const future = new Date(now.getTime() + 31_000);
        expect(first).not.toBeNull();
        expect(await reserveTwitchClipRequest(message, [config], future)).toBeNull();
        expect(await reserveTwitchClipRequest({ ...message, message_id: 'new' }, [config], future)).not.toBeNull();
    });

    it('does not create a clip for paused/unauthorized commands or wrong Shared Chat sources', async () => {
        await makeConfig('guild-a', { permission: 'moderators' });
        const test = setup();
        await test.processor.receive(message);
        await test.processor.receive({ ...message, chatter_user_id: '123', source_broadcaster_user_id: 'other' });
        await TwitchClipConfig.update({ enabled: false }, { where: { guildId: 'guild-a' } });
        await test.processor.receive({ ...message, chatter_user_id: '123' });
        expect(createTwitchCommandClip).not.toHaveBeenCalled();
        expect(await TwitchClipRequest.count()).toBe(0);
    });

    it('records offline/forbidden create failures without retrying creation', async () => {
        await makeConfig();
        vi.mocked(createTwitchCommandClip).mockRejectedValue(new TwitchClipApiError(404));
        const test = setup();
        await test.processor.receive(message);
        expect((await TwitchClipRequest.findByPk('command-id'))?.errorCode).toBe('twitch_http_404');
        expect((await TwitchClipRequest.findByPk('command-id'))?.status).toBe('failed');
        await test.processor.receive(message);
        await test.processor.deliver('command-id');
        expect(createTwitchCommandClip).toHaveBeenCalledTimes(1);
        expect(sendChannelMessagePayload).not.toHaveBeenCalled();
    });

    it('recovers known clip IDs after queue failure and retries only failed Discord destinations', async () => {
        await makeConfig();
        await makeConfig('guild-b');
        const test = setup();
        test.schedule.mockRejectedValueOnce(new Error('queue offline'));
        await expect(test.processor.receive(message)).rejects.toThrow('queue offline');
        const pending = await recoverTwitchClipRequests();
        expect(pending.map(row => row.id)).toEqual(['command-id']);
        vi.mocked(sendChannelMessagePayload).mockResolvedValueOnce({ id: 'sent' }).mockResolvedValueOnce(null);
        await setup().processor.deliver('command-id');
        expect((await TwitchClipRequest.findByPk('command-id'))?.status).toBe('ready');
        await setup().processor.deliver('command-id');
        expect(sendChannelMessagePayload).toHaveBeenCalledTimes(3);
        expect(createTwitchCommandClip).toHaveBeenCalledTimes(1);
        expect((await TwitchClipRequest.findByPk('command-id'))?.status).toBe('delivered');
    });

    it('waits for asynchronous creation, expires missing clips and cancels removed destinations', async () => {
        const config = await makeConfig();
        const test = setup();
        await test.processor.receive(message);
        vi.mocked(getTwitchCommandClip).mockResolvedValue(null);
        await test.processor.deliver('command-id');
        expect(test.schedule).toHaveBeenLastCalledWith('twitch-clips:deliver', { requestId: 'command-id' }, expect.objectContaining({ startAfterSeconds: 4 }));
        await TwitchClipRequest.update({ requestedAt: new Date(Date.now() - 61_000) }, { where: { id: 'command-id' } });
        await test.processor.deliver('command-id');
        expect((await TwitchClipRequest.findByPk('command-id'))?.errorCode).toBe('clip_not_created');
        await TwitchClipCooldown.update({ availableAt: new Date(0) }, { where: { broadcasterId: '123' } });
        await test.processor.receive({ ...message, message_id: 'other-command' });
        await config.destroy();
        await test.processor.deliver('other-command');
        expect((await TwitchClipRequest.findByPk('other-command'))?.status).toBe('delivered');
        expect(sendChannelMessagePayload).not.toHaveBeenCalled();
    });

    it('marks interrupted creation failed and retains it without re-creating it', async () => {
        const config = await makeConfig();
        await reserveTwitchClipRequest(message, [config], new Date(Date.now() - 180_000));
        expect(await recoverTwitchClipRequests()).toEqual([]);
        expect((await TwitchClipRequest.findByPk('command-id'))?.errorCode).toBe('creation_interrupted');
        await setup().processor.receive(message);
        expect(createTwitchCommandClip).not.toHaveBeenCalled();
    });
});
