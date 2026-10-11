import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigManager, getConfigManager, NotificationsManager } from '@zeffuro/fakegaming-common/managers';
import { Notification, YoutubeVideoConfig } from '@zeffuro/fakegaming-common/models';
import { registerYouTubeJobs } from '../youtube.js';
import { sendChannelMessagePayloadResult } from '../../utils/discord.js';
import { runJobOnce } from './helpers/jobTestUtils.js';

const mocks = vi.hoisted(() => ({ parseURL: vi.fn() }));
vi.mock('rss-parser', () => ({ default: class Parser { parseURL = mocks.parseURL; } }));
vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayloadResult: vi.fn() }));

const guilds = ['youtube-delivery-a', 'youtube-delivery-b'];
const manager = getConfigManager();
const originalEnrich = process.env.YOUTUBE_ENRICH_EMBEDS;

function video(id: string) {
    return { 'yt:videoId': id, title: id, link: `https://youtu.be/${id}`, author: 'Channel', published: '2026-10-01T00:00:00Z' };
}

beforeEach(async () => {
    process.env.YOUTUBE_ENRICH_EMBEDS = '0';
    await YoutubeVideoConfig.destroy({ where: { guildId: guilds } });
    await Notification.destroy({ where: { guildId: guilds } });
    for (const guildId of guilds) {
        await manager.youtubeManager.setVideoChannel({ guildId, youtubeChannelId: 'UC-delivery-test', discordChannelId: `channel-${guildId}` });
    }
    vi.mocked(sendChannelMessagePayloadResult).mockImplementation(async channelId => ({ status: 'sent', message: { id: `message-${channelId}` } }));
});

afterEach(() => {
    if (originalEnrich === undefined) delete process.env.YOUTUBE_ENRICH_EMBEDS;
    else process.env.YOUTUBE_ENRICH_EMBEDS = originalEnrich;
});

describe('YouTube feed fluctuation with persisted receipts', () => {
    it('delivers each video once per guild through feed regression, fallback and manager restart', async () => {
        const poll = () => runJobOnce('youtube:poll', registerYouTubeJobs);
        const newest = { ...video('NEWVID'), published: '2026-10-02T00:00:00Z' };
        for (const items of [[newest, video('OLDVID')], [video('OLDVID')], [newest, video('OLDVID')]]) {
            mocks.parseURL.mockResolvedValue({ items });
            await poll();
        }
        mocks.parseURL.mockRejectedValueOnce(new Error('Status code 404'));
        const fallback = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
            '<meta property="og:title" content="Channel"><script>{"videoId":"OLDVID","title":{"runs":[{"text":"Old video"}]}}</script>',
            { status: 200 },
        ));
        await poll();
        expect(fallback).toHaveBeenCalledOnce();
        expect((await manager.youtubeManager.getAllChannels()).filter(row => guilds.includes(row.guildId)).map(row => row.lastVideoId)).toEqual(['NEWVID', 'NEWVID']);
        mocks.parseURL.mockResolvedValue({ items: [newest, video('OLDVID')] });
        await poll();

        const fresh = new ConfigManager();
        const originalNotifications = manager.notificationsManager;
        const originalYoutube = manager.youtubeManager;
        manager.notificationsManager = fresh.notificationsManager;
        manager.youtubeManager = fresh.youtubeManager;
        try {
            await YoutubeVideoConfig.update({ lastVideoId: 'missing-cursor' }, { where: { guildId: guilds } });
            await poll();
        } finally {
            manager.notificationsManager = originalNotifications;
            manager.youtubeManager = originalYoutube;
        }
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledTimes(4);
        for (const guildId of guilds) {
            const calls = vi.mocked(sendChannelMessagePayloadResult).mock.calls.filter(([channelId]) => channelId === `channel-${guildId}`);
            expect(calls).toHaveLength(2);
            for (const id of ['NEWVID', 'OLDVID']) {
                expect(calls.filter(([, payload]) => String(payload.content).includes(id))).toHaveLength(1);
                expect(await new NotificationsManager().hasForGuild('youtube', id, guildId)).toBe(true);
            }
            const receipts = await Notification.findAll({ where: { provider: 'youtube', guildId } });
            expect(receipts).toHaveLength(2);
            expect(receipts.every(row => row.deliveryStatus === 'sent' && row.messageId === `message-channel-${guildId}`)).toBe(true);
        }
    });

    it('orders publication times and ignores duplicate feed entries', async () => {
        mocks.parseURL.mockResolvedValue({ items: [
            video('OLDVID'),
            { ...video('NEWVID'), published: '2026-10-02T00:00:00Z' },
            { ...video('NEWVID'), published: '2026-10-02T00:00:00Z' },
        ] });
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledTimes(2);
        for (const guildId of guilds) {
            const calls = vi.mocked(sendChannelMessagePayloadResult).mock.calls.filter(([channelId]) => channelId === `channel-${guildId}`);
            expect(calls.map(([, payload]) => String(payload.content))).toEqual([
                expect.stringContaining('NEWVID'),
            ]);
        }
        expect((await manager.youtubeManager.getAllChannels()).filter(row => guilds.includes(row.guildId)).map(row => row.lastVideoId)).toEqual(['NEWVID', 'NEWVID']);
    });

    it('retries a rejected Discord delivery on the next poll', async () => {
        await YoutubeVideoConfig.destroy({ where: { guildId: guilds[1] } });
        await YoutubeVideoConfig.update({ lastVideoId: 'OLDVID' }, { where: { guildId: guilds[0] } });
        mocks.parseURL.mockResolvedValue({ items: [{ ...video('NEWVID'), published: '2026-10-02T00:00:00Z' }, video('OLDVID')] });
        vi.mocked(sendChannelMessagePayloadResult).mockResolvedValueOnce({ status: 'rejected' });
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect((await YoutubeVideoConfig.findOne({ where: { guildId: guilds[0] } }))?.lastVideoId).toBe('OLDVID');
        expect(await Notification.count({ where: { guildId: guilds[0] } })).toBe(0);
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledTimes(2);
        expect(await Notification.count({ where: { guildId: guilds[0], deliveryStatus: 'sent' } })).toBe(1);
    });

    it('keeps the cursor retryable when an overlapping poll loses a pending claim and its owner is rejected', async () => {
        await YoutubeVideoConfig.destroy({ where: { guildId: guilds[1] } });
        await YoutubeVideoConfig.update({ lastVideoId: 'OLDVID' }, { where: { guildId: guilds[0] } });
        mocks.parseURL.mockResolvedValue({ items: [{ ...video('NEWVID'), published: '2026-10-02T00:00:00Z' }, video('OLDVID')] });
        let rejectDelivery!: (value: { status: 'rejected' }) => void;
        let entered!: () => void;
        const sending = new Promise<void>(resolve => { entered = resolve; });
        vi.mocked(sendChannelMessagePayloadResult).mockImplementationOnce(async () => {
            entered();
            return new Promise(resolve => { rejectDelivery = resolve; });
        });
        const owner = runJobOnce('youtube:poll', registerYouTubeJobs);
        await sending;
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect((await YoutubeVideoConfig.findOne({ where: { guildId: guilds[0] } }))?.lastVideoId).toBe('OLDVID');
        rejectDelivery({ status: 'rejected' });
        await owner;
        expect((await YoutubeVideoConfig.findOne({ where: { guildId: guilds[0] } }))?.lastVideoId).toBe('OLDVID');
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledTimes(2);
        expect(await Notification.count({ where: { guildId: guilds[0], deliveryStatus: 'sent' } })).toBe(1);
    });
});
