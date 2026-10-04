import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitchClipConfig, TwitchClipCooldown, TwitchClipRequest } from '@zeffuro/fakegaming-common/models';
import { Notification } from '@zeffuro/fakegaming-common/models';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { TwitchClipProcessor } from '../clipProcessor.js';
import { createTwitchCommandClip, getTwitchCommandClip, getTwitchClipCategory, TwitchClipApiError, sendTwitchClipChatMessage } from '../helix.js';
import { sendChannelMessagePayload } from '../../utils/discord.js';
import { reserveTwitchClipRequest, recoverTwitchClipRequests } from '../requestStore.js';
import type { TwitchClipChatMessage } from '../chatMessage.js';
import { getTwitchClipDownload } from '../clipDownload.js';

vi.mock('../clipDownload.js', () => ({ getTwitchClipDownload: vi.fn() }));

vi.mock('../helix.js', async importOriginal => ({
    ...await importOriginal<typeof import('../helix.js')>(),
    createTwitchCommandClip: vi.fn(), getTwitchCommandClip: vi.fn(), getTwitchClipCategory: vi.fn(), sendTwitchClipChatMessage: vi.fn(),
}));
vi.mock('../botAuth.js', () => ({ getTwitchClipBotToken: vi.fn(async () => ({
    accessToken: 'test-token', userId: 'bot', login: 'clipbot', chatReplyAuthorized: true,
})) }));
vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn() }));

const message: TwitchClipChatMessage = {
    broadcaster_user_id: '123', broadcaster_user_name: 'Streamer', chatter_user_id: '456',
    chatter_user_name: '@everyone Viewer', message_id: 'command-id', message: { text: '!clip' }, badges: [],
};
const metadata = {
    id: 'clip-id', url: 'https://clips.twitch.tv/clip-id', title: 'Nice play',
    thumbnail_url: 'https://example.com/thumbnail.jpg', broadcaster_name: 'Streamer', broadcaster_id: '123', duration: 30,
};
let testTime = Date.now();

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
    testTime += 60_000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(testTime);
    await TwitchClipRequest.destroy({ where: {} });
    await TwitchClipCooldown.destroy({ where: {} });
    await TwitchClipConfig.destroy({ where: {} });
    await Notification.destroy({ where: { provider: 'twitch' } });
    vi.mocked(createTwitchCommandClip).mockResolvedValue('clip-id');
    vi.mocked(getTwitchCommandClip).mockResolvedValue(metadata);
    vi.mocked(getTwitchClipCategory).mockResolvedValue(undefined);
    vi.mocked(getTwitchClipDownload).mockResolvedValue(undefined);
    vi.mocked(sendChannelMessagePayload).mockResolvedValue({ id: 'discord-message' });
    vi.mocked(sendTwitchClipChatMessage).mockResolvedValue(undefined);
});

afterEach(() => { vi.useRealTimers(); });

describe('Twitch command clip pipeline', () => {
    it('creates a titled clip from an alias and includes available provider metadata', async () => {
        await makeConfig('guild-a', { aliases: ['!moment'] });
        vi.mocked(getTwitchCommandClip).mockResolvedValue({ ...metadata, game_id: '27471', video_id: '2260998054', vod_offset: 2449, created_at: '2026-10-04T17:24:07Z' });
        vi.mocked(getTwitchClipCategory).mockResolvedValue('Minecraft');
        vi.mocked(getTwitchClipDownload).mockResolvedValue('https://clips-media-assets2.twitch.tv/public.mp4?sig=signed');
        const test = setup();
        await test.processor.receive({ ...message, message: { text: '!moment Nice play' } });
        expect(createTwitchCommandClip).toHaveBeenCalledExactlyOnceWith('123', 30, 'Nice play');
        await test.processor.deliver(message.message_id);
        const payload = vi.mocked(sendChannelMessagePayload).mock.calls[0][1];
        expect(JSON.stringify(payload)).toContain('Minecraft');
        expect(JSON.stringify(payload)).toContain('public.mp4?sig=signed');
        expect(JSON.stringify(payload)).toContain('https://www.twitch.tv/videos/2260998054?t=00h40m49s');
        expect(payload).toMatchObject({ embeds: [expect.objectContaining({ timestamp: '2026-10-04T17:24:07.000Z' })] });
    });
    it('creates one clip across matching guilds and delivers once per destination with mention suppression', async () => {
        const first = await makeConfig();
        const second = await makeConfig('guild-b', { cooldownSeconds: 60, durationSeconds: 45 });
        const test = setup();
        await Promise.all([test.processor.receive(message), test.processor.receive(message)]);
        expect(createTwitchCommandClip).toHaveBeenCalledExactlyOnceWith('123', 45, undefined);
        const row = await TwitchClipRequest.findByPk('command-id');
        expect(row?.clipId).toBe('clip-id');
        expect(row?.status).toBe('ready');
        expect(JSON.parse(row?.targetsJson ?? '[]')).toEqual(expect.arrayContaining([first.id, second.id]));
        await Promise.all([test.processor.deliver('command-id'), test.processor.deliver('command-id')]);
        expect(sendChannelMessagePayload).toHaveBeenCalledTimes(2);
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
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
        await test.processor.deliver('burst-0');
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
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
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
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
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
    });

    it('waits for asynchronous creation, expires missing clips and cancels removed destinations', async () => {
        const config = await makeConfig();
        const test = setup();
        await test.processor.receive(message);
        vi.mocked(getTwitchCommandClip).mockResolvedValue(null);
        await test.processor.deliver('command-id');
        expect(test.schedule).toHaveBeenLastCalledWith('twitch-clips:deliver', { requestId: 'command-id' }, expect.objectContaining({ startAfterSeconds: 4 }));
        await TwitchClipRequest.update({ clipAcceptedAt: new Date(Date.now() - 61_000) }, { where: { id: 'command-id' } });
        await test.processor.deliver('command-id');
        expect((await TwitchClipRequest.findByPk('command-id'))?.errorCode).toBe('clip_not_created');
        await TwitchClipCooldown.update({ availableAt: new Date(0) }, { where: { broadcasterId: '123' } });
        await test.processor.receive({ ...message, message_id: 'other-command' });
        await config.destroy();
        await test.processor.deliver('other-command');
        expect((await TwitchClipRequest.findByPk('other-command'))?.status).toBe('delivered');
        expect(sendChannelMessagePayload).not.toHaveBeenCalled();
    });

    it('gives a delayed create response the full publication window and preserves it across restarts', async () => {
        const start = Date.now();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(start);
        await makeConfig();
        vi.mocked(createTwitchCommandClip).mockImplementationOnce(async () => {
            vi.setSystemTime(start + 20_000);
            return 'clip-id';
        });
        await setup().processor.receive(message);
        const request = await TwitchClipRequest.findByPk(message.message_id);
        expect(new Date(request?.requestedAt ?? 0).getTime()).toBe(start);
        expect(new Date(request?.clipAcceptedAt ?? 0).getTime()).toBe(start + 20_000);
        vi.mocked(getTwitchCommandClip).mockResolvedValue(null);
        vi.setSystemTime(start + 79_999);
        const resumed = setup();
        await resumed.processor.deliver(message.message_id);
        expect((await TwitchClipRequest.findByPk(message.message_id))?.status).toBe('ready');
        expect(resumed.schedule).toHaveBeenLastCalledWith('twitch-clips:deliver', { requestId: message.message_id },
            expect.objectContaining({ startAfterSeconds: 4 }));
        vi.mocked(getTwitchCommandClip).mockResolvedValue(metadata);
        vi.setSystemTime(start + 80_000);
        await resumed.processor.deliver(message.message_id);
        expect((await TwitchClipRequest.findByPk(message.message_id))?.status).toBe('delivered');
        expect(createTwitchCommandClip).toHaveBeenCalledOnce();
        expect(sendChannelMessagePayload).toHaveBeenCalledOnce();
    });

    it('expires an absent clip at sixty seconds after acceptance without repeating creation', async () => {
        const start = Date.now();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(start);
        await makeConfig();
        await setup().processor.receive(message);
        vi.mocked(getTwitchCommandClip).mockResolvedValue(null);
        vi.setSystemTime(start + 60_000);
        await setup().processor.deliver(message.message_id);
        expect((await TwitchClipRequest.findByPk(message.message_id))?.errorCode).toBe('clip_not_created');
        expect((await recoverTwitchClipRequests()).length).toBe(0);
        await setup().processor.deliver(message.message_id);
        expect(createTwitchCommandClip).toHaveBeenCalledOnce();
        expect(sendChannelMessagePayload).not.toHaveBeenCalled();
    });

    it('keeps the existing timeout for pending requests created before acceptance timestamps existed', async () => {
        await makeConfig();
        await setup().processor.receive(message);
        await TwitchClipRequest.update({ clipAcceptedAt: null, requestedAt: new Date(Date.now() - 61_000) },
            { where: { id: message.message_id } });
        vi.mocked(getTwitchCommandClip).mockResolvedValue(null);
        await setup().processor.deliver(message.message_id);
        expect((await TwitchClipRequest.findByPk(message.message_id))?.errorCode).toBe('clip_not_created');
        expect(createTwitchCommandClip).toHaveBeenCalledOnce();
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
