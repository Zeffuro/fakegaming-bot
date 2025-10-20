import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

vi.mock('rss-parser', () => ({ default: class Parser { async parseURL(_url: string){ return { items: [{
    'yt:videoId': 'VID123', title: 'New Video', link: 'https://youtu.be/VID123', author: 'Channel', published: '2025-01-01T00:00:00Z',
    mediaGroup: { 'media:thumbnail': { $: { url: 'https://i.ytimg.com/vi/VID123/hqdefault.jpg' } } },
}] }; } } }));

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const upsert = vi.fn().mockResolvedValue(null);
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    youtubeManager: { getAllChannels: vi.fn().mockResolvedValue([{ id: 'cfg1', guildId: 'g', discordChannelId: 'chan', youtubeChannelId: 'UC123', lastVideoId: null, customMessage: 'Watch {title} by {channel}! {url}', cooldownMinutes: 0 }]), upsert },
    notificationsManager: { has: vi.fn().mockResolvedValue(false), recordIfNew: vi.fn().mockResolvedValue(undefined) }
}) }));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn().mockResolvedValue({ id: 'msg1' }) }));

import { registerYouTubeJobs } from '../youtube.js';

const mockFetch = vi.fn();

describe('YouTube poll integration', () => {
    beforeEach(() => {
        (globalThis as any).fetch = mockFetch;
        process.env = { ...ORIGINAL_ENV, YOUTUBE_API_KEY: 'key', YOUTUBE_ENRICH_EMBEDS: '1' };
        mockFetch.mockReset();
        // Mock YouTube videos details API
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'VID123', contentDetails: { duration: 'PT5M3S' }, statistics: { viewCount: '1234' } }] }) });
    });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

    it('processes a new video and sends a message', async () => {
        const q: any = { handlers: new Map<string, Function>(), on(n: string, h: any){ this.handlers.set(n,h); }, async start(){}, async schedule(){ return 'id'; } };
        await registerYouTubeJobs(q, new Date('2025-01-01T00:00:00Z'));
        const h = q.handlers.get('youtube:poll');
        expect(typeof h).toBe('function');
        const done = vi.fn();
        await h({ data: {}, done });
        expect(done).toHaveBeenCalled();
        expect(upsert).toHaveBeenCalled();
    });
});

