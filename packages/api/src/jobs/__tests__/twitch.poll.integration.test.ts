import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const upsert = vi.fn().mockResolvedValue(null);
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    twitchManager: { getAllStreams: vi.fn().mockResolvedValue([{ id: 't1', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer', isLive: false, cooldownMinutes: 0 }]), upsert },
    notificationsManager: { has: vi.fn().mockResolvedValue(false), recordIfNew: vi.fn().mockResolvedValue(undefined) }
}) }));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn().mockResolvedValue({ id: 'msg1' }) }));

import { registerTwitchJobs } from '../twitch.js';

const mockFetch = vi.fn();

describe('Twitch poll integration', () => {
    beforeEach(() => {
        (globalThis as any).fetch = mockFetch;
        process.env = { ...ORIGINAL_ENV, TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'csecret' };
        mockFetch.mockReset();
        // 1) App token
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
        // 2) users by login
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'u1', login: 'streamer', display_name: 'Streamer', profile_image_url: 'https://avatar' }] }) });
        // 3) streams by user id
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 's1', user_id: 'u1', title: 'Live now', viewer_count: 100, started_at: new Date(Date.now()-60_000).toISOString(), thumbnail_url: 'https://thumb/{width}x{height}.jpg', game_id: 'g1' }] }) });
        // 4) games by id
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'g1', name: 'Cool Game' }] }) });
    });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

    it('processes a live stream and sends a message', async () => {
        const q: any = { handlers: new Map<string, Function>(), on(n: string, h: any){ this.handlers.set(n,h); }, async start(){}, async schedule(){ return 'id'; } };
        await registerTwitchJobs(q, new Date('2025-01-01T00:00:00Z'));
        const h = q.handlers.get('twitch:poll');
        expect(typeof h).toBe('function');
        const done = vi.fn();
        await h({ data: {}, done });
        expect(done).toHaveBeenCalled();
        expect(upsert).toHaveBeenCalled();
    });
});

