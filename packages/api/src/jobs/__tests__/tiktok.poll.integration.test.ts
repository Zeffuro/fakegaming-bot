import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const upsert = vi.fn().mockResolvedValue(null);
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    tiktokManager: { getAllStreams: vi.fn().mockResolvedValue([{ id: 'tk1', guildId: 'g', discordChannelId: 'chan', tiktokUsername: 'creator', isLive: false, cooldownMinutes: 0 }]), upsert },
    notificationsManager: { has: vi.fn().mockResolvedValue(false), recordIfNew: vi.fn().mockResolvedValue(undefined) }
}) }));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn().mockResolvedValue({ id: 'msg1' }) }));

vi.mock('tiktok-live-connector', () => ({
    TikTokLiveConnection: vi.fn().mockImplementation((_username: string) => ({
        connect: vi.fn().mockResolvedValue({ roomId: '12345', roomInfo: { room: { title: 'Live now!', create_time: Math.floor((Date.now()-60000)/1000), user_count: 100 } } }),
        disconnect: vi.fn().mockResolvedValue(undefined)
    }))
}));

import { registerTikTokJobs } from '../tiktok.js';

const mockFetch = vi.fn();

describe('TikTok poll integration', () => {
    beforeEach(() => {
        (globalThis as any).fetch = mockFetch;
        process.env = { ...ORIGINAL_ENV };
        mockFetch.mockReset();
        // HTML with SIGI_STATE including liveRoomId and create_time
        const html = `<!doctype html><html><head></head><body>
        <script id="SIGI_STATE">{"LiveRoom":{"liveRoomId":"12345","status":2,"create_time":${Math.floor((Date.now()-60000)/1000)},"title":"Live now!","user_count":100}}</script>
        </body></html>`;
        mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html });
    });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

    it('processes a live stream and sends a message', async () => {
        const q: any = { handlers: new Map<string, Function>(), on(n: string, h: any){ this.handlers.set(n,h); }, async start(){}, async schedule(){ return 'id'; } };
        await registerTikTokJobs(q, new Date('2025-01-01T00:00:00Z'));
        const h = q.handlers.get('tiktok:poll');
        expect(typeof h).toBe('function');
        const done = vi.fn();
        await h({ data: {}, done });
        expect(done).toHaveBeenCalled();
        expect(upsert).toHaveBeenCalled();
    });
});
