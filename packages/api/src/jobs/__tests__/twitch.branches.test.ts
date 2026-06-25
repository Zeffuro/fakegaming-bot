import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { registerTwitchJobs } from '../twitch.js';
import { recordJobRun } from '../status.js';
import { prepareDiscord, runJobOnce } from './helpers/jobTestUtils.js';

const ORIGINAL_ENV = { ...process.env };

const upsert = vi.fn().mockResolvedValue(null);
const manager = {
    twitchManager: { getAllStreams: vi.fn(), findByPkPlain: vi.fn(), upsert },
    notificationsManager: { has: vi.fn(), recordIfNew: vi.fn() }
};

vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => manager }));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn().mockResolvedValue({ id: 'msg1' }) }));

const mockFetch = vi.fn();

function setFetchSequence(seq: Array<any>) {
    mockFetch.mockReset();
    for (const v of seq) mockFetch.mockResolvedValueOnce(v);
}

describe('Twitch job branches', () => {
    beforeEach(() => {
        (globalThis as any).fetch = mockFetch;
        upsert.mockReset();
        manager.twitchManager.getAllStreams.mockReset();
        manager.twitchManager.findByPkPlain.mockReset();
        manager.notificationsManager.has.mockReset();
        manager.notificationsManager.recordIfNew.mockReset();
        vi.mocked(recordJobRun).mockReset();
        process.env = { ...ORIGINAL_ENV, TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'csecret' };
    });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; vi.restoreAllMocks(); });

    it('skips paused configs before fetching Twitch credentials', async () => {
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([
            { id: 't-paused', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer', isLive: false, paused: true },
        ]);
        mockFetch.mockReset();

        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);

        expect(done).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('suppresses notification during quiet hours and cooldown, but updates live status', async () => {
        const cfg = { id: 't2', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer', isLive: false, quietHoursStart: '00:00', quietHoursEnd: '23:59', cooldownMinutes: 10, lastNotifiedAt: new Date().toISOString() } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        manager.notificationsManager.has.mockResolvedValue(false);
        setFetchSequence([
            { ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) },
            { ok: true, json: async () => ({ data: [{ id: 'u1', login: 'streamer', display_name: 'Streamer', profile_image_url: 'https://avatar' }] }) },
            { ok: true, json: async () => ({ data: [{ id: 's1', user_id: 'u1', title: 'Live', viewer_count: 1, started_at: new Date().toISOString(), thumbnail_url: '', game_id: null }] }) },
            { ok: true, json: async () => ({ data: [] }) },
        ]);
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
        expect(cfg.isLive).toBe(true);
    });

    it('marks stream offline when previously live and no stream found', async () => {
        const cfg = { id: 't3', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer', isLive: true } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        setFetchSequence([
            // Token is cached from previous test; first fetch is users
            { ok: true, json: async () => ({ data: [{ id: 'u1', login: 'streamer' }] }) },
            // Streams by user id -> none
            { ok: true, json: async () => ({ data: [] }) },
        ]);
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
        expect(cfg.isLive).toBe(false);
    });

    it('records job failure when env is missing for app token', async () => {
        process.env = { ...ORIGINAL_ENV, TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' };
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([{ id: 't4', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer', isLive: false }]);
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
    });

    it('skips sending when notification already exists but marks config live', async () => {
        const cfg = { id: 't5', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer2', isLive: false } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        manager.notificationsManager.has.mockResolvedValue(true);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/users')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'u2', login: 'streamer2', display_name: 'Streamer Two' }] }) });
            if (u.includes('/streams')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 's2', user_id: 'u2', title: 'Live again', viewer_count: 10, started_at: new Date().toISOString(), thumbnail_url: '', game_id: null }] }) });
            if (u.includes('/games')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            return Promise.resolve({ ok: false, json: async () => ({}) });
        });
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
        expect(cfg.isLive).toBe(true);
        expect((discord as any).sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(manager.notificationsManager.recordIfNew).not.toHaveBeenCalled();
        expect(upsert).toHaveBeenCalled();
    });

    it('does not record notification when Discord send returns no id', async () => {
        const cfg = { id: 't6', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'streamer3', isLive: false } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        manager.notificationsManager.has.mockResolvedValue(false);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/users')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'u3', login: 'streamer3' }] }) });
            if (u.includes('/streams')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 's3', user_id: 'u3', title: 'No id send', viewer_count: 5, started_at: new Date().toISOString(), thumbnail_url: '', game_id: null }] }) });
            if (u.includes('/games')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            return Promise.resolve({ ok: false, json: async () => ({}) });
        });
        const { discord } = await prepareDiscord();
        (discord as any).sendChannelMessagePayload.mockResolvedValueOnce({});
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
        expect(cfg.isLive).toBe(true);
        expect(manager.notificationsManager.recordIfNew).not.toHaveBeenCalled();
        expect(upsert).toHaveBeenCalled();
    });

    it('ignores configs when user lookup fails (no user id)', async () => {
        const cfg = { id: 't7', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'unknown', isLive: false } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        manager.notificationsManager.has.mockResolvedValue(false);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/users')) return Promise.resolve({ ok: false, json: async () => ({}) });
            // streams/games should not be called due to empty users
            return Promise.resolve({ ok: false, json: async () => ({}) });
        });
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
        expect(cfg.isLive).toBe(false);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('uses custom message without {url} and appends stream URL', async () => {
        const cfg = { id: 't8', guildId: 'g', discordChannelId: 'chan', twitchUsername: 'custom', isLive: false, customMessage: 'Live now: {title}' } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        manager.notificationsManager.has.mockResolvedValue(false);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/users')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'u8', login: 'custom', display_name: 'Custom' }] }) });
            if (u.includes('/streams')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 's8', user_id: 'u8', title: 'Great Stream', viewer_count: 42, started_at: new Date().toISOString(), thumbnail_url: 'https://thumb/{width}x{height}.jpg', game_id: 'g9' }] }) });
            if (u.includes('/games')) return Promise.resolve({ ok: false, json: async () => ({}) }); // branch: games fetch fails
            return Promise.resolve({ ok: false, json: async () => ({}) });
        });
        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);
        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalledTimes(1);
        const call = (discord as any).sendChannelMessagePayload.mock.calls[0];
        expect(call[0]).toBe('chan');
        const payload = call[1];
        expect(typeof payload?.content).toBe('string');
        expect(payload.content).toContain('Live now: Great Stream');
        expect(String(payload.content)).toMatch(/\n<?https:\/\/twitch\.tv\/custom>?/);
    });

    it('deduplicates repeated usernames before calling Helix', async () => {
        const cfgs = [
            { id: 't9a', guildId: 'g1', discordChannelId: 'chan1', twitchUsername: 'samecreator', isLive: false },
            { id: 't9b', guildId: 'g2', discordChannelId: 'chan2', twitchUsername: 'SameCreator', isLive: false },
        ] as any[];
        const usersUrls: string[] = [];
        manager.twitchManager.getAllStreams.mockResolvedValueOnce(cfgs);
        manager.notificationsManager.has.mockResolvedValue(false);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/users')) {
                usersUrls.push(u);
                return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'u9', login: 'samecreator', display_name: 'Same Creator' }] }) });
            }
            if (u.includes('/streams')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 's9', user_id: 'u9', title: 'Shared live', viewer_count: 7, started_at: new Date().toISOString(), thumbnail_url: '', game_id: null }] }) });
            if (u.includes('/games')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            return Promise.resolve({ ok: false, json: async () => ({}) });
        });

        const { discord } = await prepareDiscord();
        const { done } = await runJobOnce('twitch:poll', registerTwitchJobs);

        expect(done).toHaveBeenCalled();
        expect(usersUrls).toHaveLength(1);
        expect(usersUrls[0].match(/(?:\?|&)login=/g)).toHaveLength(1);
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalledTimes(2);
    });

    it('schedules a VOD follow-up when a configured stream goes offline', async () => {
        const cfg = {
            id: 't-vod-schedule',
            guildId: 'g',
            discordChannelId: 'chan',
            twitchUsername: 'vodstreamer',
            isLive: true,
            vodFollowupEnabled: true,
            vodFollowupDelayMinutes: 1,
        } as any;
        manager.twitchManager.getAllStreams.mockResolvedValueOnce([cfg]);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/users')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'u-vod', login: 'vodstreamer', display_name: 'Vod Streamer' }] }) });
            if (u.includes('/streams')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
        });

        const { q, done } = await runJobOnce('twitch:poll', registerTwitchJobs);

        expect(done).toHaveBeenCalled();
        expect(cfg.isLive).toBe(false);
        expect(q.scheduled).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'twitch:vod-followup',
                data: expect.objectContaining({ configId: 't-vod-schedule', twitchUserId: 'u-vod' }),
                options: expect.objectContaining({ startAfterSeconds: 60 }),
            }),
        ]));
        expect(recordJobRun).toHaveBeenCalledWith('twitch', expect.objectContaining({
            meta: expect.objectContaining({
                vodFollowupsScheduled: 1,
                vodFollowupScheduleErrors: 0,
            }),
        }));
    });

    it('sends the latest VOD follow-up and stores the VOD id', async () => {
        const cfg = {
            id: 't-vod-send',
            guildId: 'g',
            discordChannelId: 'chan',
            twitchUsername: 'streamer',
            isLive: false,
            vodFollowupEnabled: true,
            lastVodId: null,
        } as any;
        manager.twitchManager.findByPkPlain.mockResolvedValueOnce(cfg);
        manager.notificationsManager.has.mockResolvedValue(false);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/videos')) return Promise.resolve({
                ok: true,
                json: async () => ({
                    data: [{
                        id: 'vod-1',
                        user_id: 'u-vod',
                        title: 'Stream archive',
                        url: 'https://www.twitch.tv/videos/vod-1',
                        duration: '1h2m3s',
                        published_at: '2026-06-25T10:00:00Z',
                    }],
                }),
            });
            return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
        });
        const { discord } = await prepareDiscord();
        (discord as any).sendChannelMessagePayload.mockResolvedValue({ id: 'msg1' });
        const q = new TestJobQueue();
        await registerTwitchJobs(q as any, new Date('2025-01-01T00:00:00Z'));

        const { done } = await runJobHandler(q, 'twitch:vod-followup', {
            configId: 't-vod-send',
            twitchUserId: 'u-vod',
            twitchUsername: 'streamer',
            twitchDisplayName: 'Streamer',
        });

        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).toHaveBeenCalledWith('chan', expect.objectContaining({
            content: expect.stringContaining('Latest VOD from Streamer'),
        }));
        expect(cfg.lastVodId).toBe('vod-1');
        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ lastVodId: 'vod-1' }), ['id']);
        expect(recordJobRun).toHaveBeenCalledWith('twitch', expect.objectContaining({
            meta: expect.objectContaining({
                job: 'vod-followup',
                status: 'notified',
                username: 'streamer',
                vodId: 'vod-1',
                delivered: true,
            }),
        }));
    });

    it('records VOD follow-up metadata when no archive is available yet', async () => {
        const cfg = {
            id: 't-vod-empty',
            guildId: 'g',
            discordChannelId: 'chan',
            twitchUsername: 'emptyvod',
            isLive: false,
            vodFollowupEnabled: true,
            lastVodId: null,
        } as any;
        manager.twitchManager.findByPkPlain.mockResolvedValueOnce(cfg);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/videos')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
        });
        const { discord } = await prepareDiscord();
        const q = new TestJobQueue();
        await registerTwitchJobs(q as any, new Date('2025-01-01T00:00:00Z'));

        const { done } = await runJobHandler(q, 'twitch:vod-followup', {
            configId: 't-vod-empty',
            twitchUserId: 'u-empty-vod',
            twitchUsername: 'emptyvod',
            twitchDisplayName: 'Empty Vod',
        });

        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(recordJobRun).toHaveBeenCalledWith('twitch', expect.objectContaining({
            ok: true,
            meta: expect.objectContaining({
                job: 'vod-followup',
                status: 'no_archive_video',
                username: 'emptyvod',
            }),
        }));
    });

    it('records duplicate VOD suppression in follow-up metadata', async () => {
        const cfg = {
            id: 't-vod-duplicate',
            guildId: 'g',
            discordChannelId: 'chan',
            twitchUsername: 'duplicatevod',
            isLive: false,
            vodFollowupEnabled: true,
            lastVodId: 'vod-duplicate',
        } as any;
        manager.twitchManager.findByPkPlain.mockResolvedValueOnce(cfg);
        mockFetch.mockReset();
        mockFetch.mockImplementation((url: any) => {
            const u = String(url);
            if (u.includes('/oauth2/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 'app', expires_in: 3600 }) });
            if (u.includes('/videos')) return Promise.resolve({
                ok: true,
                json: async () => ({ data: [{ id: 'vod-duplicate', user_id: 'u-dup-vod', title: 'Existing archive' }] }),
            });
            return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
        });
        const { discord } = await prepareDiscord();
        const q = new TestJobQueue();
        await registerTwitchJobs(q as any, new Date('2025-01-01T00:00:00Z'));

        const { done } = await runJobHandler(q, 'twitch:vod-followup', {
            configId: 't-vod-duplicate',
            twitchUserId: 'u-dup-vod',
            twitchUsername: 'duplicatevod',
            twitchDisplayName: 'Duplicate Vod',
        });

        expect(done).toHaveBeenCalled();
        expect((discord as any).sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
        expect(recordJobRun).toHaveBeenCalledWith('twitch', expect.objectContaining({
            ok: true,
            meta: expect.objectContaining({
                job: 'vod-followup',
                status: 'duplicate_last_vod',
                username: 'duplicatevod',
                vodId: 'vod-duplicate',
            }),
        }));
    });
});
