import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerYouTubeJobs } from '../youtube.js';
import { prepareDiscord, runJobOnce } from './helpers/jobTestUtils.js';

const ORIGINAL_ENV = { ...process.env };

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const upsert = vi.fn().mockResolvedValue(null);
const has = vi.fn();
const recordIfNew = vi.fn();
const manager = {
    youtubeManager: { getAllChannels: vi.fn(), upsert },
    notificationsManager: { has, recordIfNew }
};
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => manager }));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn().mockResolvedValue({ id: 'msg1' }) }));

// Default rss-parser mock (overridden in specific tests when needed)
vi.mock('rss-parser', () => ({ default: class Parser { async parseURL(_url: string){ return { items: [{
    'yt:videoId': 'VIDX', title: 'Video X', link: 'https://youtu.be/VIDX', author: 'Channel', published: '2025-01-01T00:00:00Z'
}] }; } } }));

describe('YouTube job branches', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV, YOUTUBE_ENRICH_EMBEDS: '0' };
        upsert.mockReset(); has.mockReset(); recordIfNew.mockReset();
        manager.youtubeManager.getAllChannels.mockReset();
    });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

    it('suppresses by quiet hours/cooldown and still updates lastVideoId', async () => {
        const cfg = { id: 'yc1', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC1', lastVideoId: null, quietHoursStart: '00:00', quietHoursEnd: '23:59', cooldownMinutes: 10, lastNotifiedAt: new Date().toISOString() } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        has.mockResolvedValue(false);
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        expect(cfg.lastVideoId).toBe('VIDX');
        expect(recordIfNew).not.toHaveBeenCalled();
    });

    it('skips when already notified', async () => {
        const cfg = { id: 'yc2', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC2', lastVideoId: null } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        has.mockResolvedValue(true);
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        expect(recordIfNew).not.toHaveBeenCalled();
    });

    it('handles feed fetch error gracefully', async () => {
        // Override rss-parser to throw
        vi.doMock('rss-parser', () => ({ default: class Parser { async parseURL(){ throw new Error('fail'); } } }));
        const cfg = { id: 'yc3', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC3', lastVideoId: null } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
    });

    it('does nothing when lastVideoId equals latest (no new videos)', async () => {
        const cfg = { id: 'yc4', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC4', lastVideoId: 'VIDX' } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('appends url when customMessage lacks {url}', async () => {
        const cfg = { id: 'yc5', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC5', lastVideoId: null, customMessage: 'Watch {title} by {channel}!' } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        has.mockResolvedValue(false);
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalledTimes(1);
        const payload = (discord as any).sendChannelMessagePayload.mock.calls[0][1];
        expect(String(payload?.content)).toContain('Watch Video X by Channel!');
        expect(String(payload?.content)).toContain('\nhttps://youtu.be/VIDX');
    });

    it('enrich enabled but details API returns !ok, continues without details', async () => {
        process.env = { ...ORIGINAL_ENV, YOUTUBE_API_KEY: 'key', YOUTUBE_ENRICH_EMBEDS: '1' };
        (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
        const cfg = { id: 'yc6', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC6', lastVideoId: null } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        has.mockResolvedValue(false);
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        // Still sent despite no details
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalled();
    });

    it('skips configs without required IDs', async () => {
        const cfgs: any[] = [
            { id: 'yc7', guildId: 'g', discordChannelId: '', youtubeChannelId: 'UC7', lastVideoId: null },
            { id: 'yc8', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: '', lastVideoId: null },
        ];
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce(cfgs);
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).not.toHaveBeenCalled();
    });

    it('processes first item when lastVideoId matches second item (slice then reverse path)', async () => {
        // Reset module cache to ensure youtube.ts picks up the new rss-parser mock
        vi.resetModules();
        // Override rss-parser to return two items
        vi.doMock('rss-parser', () => ({ default: class Parser { async parseURL(){ return { items: [
            { 'yt:videoId': 'A', title: 'A', link: 'https://youtu.be/A', author: 'Channel', published: '2025-01-01T00:00:00Z' },
            { 'yt:videoId': 'B', title: 'B', link: 'https://youtu.be/B', author: 'Channel', published: '2025-01-01T00:05:00Z' }
        ] }; } } }));
        const cfg = { id: 'yc9', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC9', lastVideoId: 'B' } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        has.mockResolvedValue(false);
        // Fresh import picks up the new mock after resetModules
        const { registerYouTubeJobs: freshRegister } = await import('../youtube.js');
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('youtube:poll', freshRegister);
        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalledTimes(1);
        const payload = (discord as any).sendChannelMessagePayload.mock.calls[0][1];
        expect(String(payload?.content)).toContain('https://youtu.be/A');
        expect(cfg.lastVideoId).toBe('A');
    });

    it('continues when details API throws (catch branch)', async () => {
        process.env = { ...ORIGINAL_ENV, YOUTUBE_API_KEY: 'key', YOUTUBE_ENRICH_EMBEDS: '1' };
        (globalThis as any).fetch = vi.fn().mockImplementation(() => { throw new Error('boom'); });
        const cfg = { id: 'yc10', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC10', lastVideoId: null } as any;
        manager.youtubeManager.getAllChannels.mockResolvedValueOnce([cfg]);
        has.mockResolvedValue(false);
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('youtube:poll', registerYouTubeJobs);
        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalled();
    });
});
