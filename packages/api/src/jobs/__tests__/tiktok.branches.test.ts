import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks to be safe with Vitest's hoisting behavior
const hoisted = vi.hoisted(() => {
    return {
        getAllStreams: vi.fn(),
        upsert: vi.fn(),
        notificationsHas: vi.fn(),
        recordIfNew: vi.fn(),
        sendChannelMessagePayload: vi.fn(),
        recordJobRun: vi.fn(),
    };
});

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        tiktokManager: { getAllStreams: hoisted.getAllStreams, upsert: hoisted.upsert },
        notificationsManager: { has: hoisted.notificationsHas, recordIfNew: hoisted.recordIfNew }
    })
}));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: hoisted.sendChannelMessagePayload }));
vi.mock('../status.js', () => ({ recordJobRun: hoisted.recordJobRun }));

// Default live-connector mock; tests can override connect to throw
vi.mock('tiktok-live-connector', () => ({
    TikTokLiveConnection: vi.fn()
}));

import { registerTikTokJobs } from '../tiktok.js';

function makeQueue() {
    return {
        handlers: new Map<string, (job: any) => Promise<void>>(),
        on(name: string, handler: (job: any) => Promise<void>) { this.handlers.set(name, handler); },
        async start() {},
        async schedule() { return 'id'; }
    } as any;
}

function makeCfg(extra?: Record<string, unknown>) {
    return { id: 'id1', guildId: 'g1', discordChannelId: 'chan1', tiktokUsername: 'creator1', isLive: false, ...extra };
}

describe('tiktok job branches', () => {
    beforeEach(async () => {
        hoisted.getAllStreams.mockReset();
        hoisted.upsert.mockReset();
        hoisted.notificationsHas.mockReset();
        hoisted.recordIfNew.mockReset();
        hoisted.sendChannelMessagePayload.mockReset();
        hoisted.recordJobRun.mockReset();
        // Set default connector to successful connect each test
        const { TikTokLiveConnection } = await import('tiktok-live-connector');
        (TikTokLiveConnection as any).mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue({ roomInfo: { room: { id: 'roomX', title: 't', create_time: Math.floor((Date.now()-60000)/1000), user_count: 10 } } }),
            disconnect: vi.fn().mockResolvedValue(undefined)
        }));
    });
    afterEach(() => { vi.clearAllMocks(); });

    it('suppresses when already notified', async () => {
        hoisted.getAllStreams.mockResolvedValue([makeCfg()]);
        hoisted.notificationsHas.mockResolvedValue(true);
        hoisted.sendChannelMessagePayload.mockResolvedValue({ id: 'm1' });

        const q = makeQueue();
        await registerTikTokJobs(q);
        const h = q.handlers.get('tiktok:poll')!;
        const done = vi.fn();
        await h({ data: {}, done });

        expect(done).toHaveBeenCalled();
        expect(hoisted.sendChannelMessagePayload).not.toHaveBeenCalled();
        // Job sets isLive=true then persists even if already notified
        expect(hoisted.upsert).toHaveBeenCalled();
    });

    it('suppresses during quiet hours', async () => {
        hoisted.getAllStreams.mockResolvedValue([makeCfg({ quietHoursStart: '00:00', quietHoursEnd: '23:59' })]);
        hoisted.notificationsHas.mockResolvedValue(false);
        hoisted.sendChannelMessagePayload.mockResolvedValue({ id: 'm1' });

        const q = makeQueue();
        await registerTikTokJobs(q);
        const h = q.handlers.get('tiktok:poll')!;
        const done = vi.fn();
        await h({ data: {}, done });

        expect(hoisted.sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(hoisted.upsert).toHaveBeenCalled();
    });

    it('suppresses due to cooldown', async () => {
        const last = new Date(Date.now() - 60_000);
        hoisted.getAllStreams.mockResolvedValue([makeCfg({ cooldownMinutes: 10, lastNotifiedAt: last.toISOString() })]);
        hoisted.notificationsHas.mockResolvedValue(false);
        hoisted.sendChannelMessagePayload.mockResolvedValue({ id: 'm1' });

        const q = makeQueue();
        await registerTikTokJobs(q);
        const h = q.handlers.get('tiktok:poll')!;
        const done = vi.fn();
        await h({ data: {}, done });

        expect(hoisted.sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(hoisted.upsert).toHaveBeenCalled();
    });

    it('falls back to cfg.save() when upsert rejects', async () => {
        const cfg: any = makeCfg();
        cfg.save = vi.fn().mockResolvedValue(undefined);
        hoisted.getAllStreams.mockResolvedValue([cfg]);
        hoisted.notificationsHas.mockResolvedValue(false);
        hoisted.sendChannelMessagePayload.mockResolvedValue({ id: 'm1' });
        hoisted.upsert.mockRejectedValue(new Error('db'));

        const q = makeQueue();
        await registerTikTokJobs(q);
        const h = q.handlers.get('tiktok:poll')!;
        const done = vi.fn();
        await h({ data: {}, done });

        expect(hoisted.sendChannelMessagePayload).toHaveBeenCalled();
        expect(cfg.save).toHaveBeenCalled();
    });

    it('handles not-live by toggling off and persisting', async () => {
        // Make connect throw => resolveTikTokLive returns live:false
        const { TikTokLiveConnection } = await import('tiktok-live-connector');
        (TikTokLiveConnection as any).mockImplementation(() => ({
            connect: vi.fn().mockRejectedValue(new Error('offline')),
            disconnect: vi.fn().mockResolvedValue(undefined)
        }));
        hoisted.getAllStreams.mockResolvedValue([makeCfg({ isLive: true })]);
        hoisted.upsert.mockResolvedValue(null);

        const q = makeQueue();
        await registerTikTokJobs(q);
        const h = q.handlers.get('tiktok:poll')!;
        const done = vi.fn();
        await h({ data: {}, done });

        expect(hoisted.upsert).toHaveBeenCalled();
        expect(done).toHaveBeenCalled();
    });

    it('records error when send fails inside loop', async () => {
        hoisted.getAllStreams.mockResolvedValue([makeCfg()]);
        hoisted.notificationsHas.mockResolvedValue(false);
        hoisted.sendChannelMessagePayload.mockRejectedValue(new Error('discord down'));

        const q = makeQueue();
        await registerTikTokJobs(q);
        const h = q.handlers.get('tiktok:poll')!;
        const done = vi.fn();
        await h({ data: {}, done });

        // ensure recordJobRun captured a run (ok may be false)
        expect(hoisted.recordJobRun).toHaveBeenCalled();
        const last = hoisted.recordJobRun.mock.calls.at(-1);
        const meta = last?.[1]?.meta as any;
        expect(meta && typeof meta.processed === 'number').toBe(true);
    });
});
