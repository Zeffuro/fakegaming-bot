import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerBlueskyJobs } from '../bluesky.js';

const hoisted = vi.hoisted(() => ({
    getAllAccounts: vi.fn(),
    upsert: vi.fn(),
    notificationsHas: vi.fn(),
    recordIfNew: vi.fn(),
    sendChannelMessagePayload: vi.fn(),
    recordJobRun: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        blueskyManager: { getAllAccounts: hoisted.getAllAccounts, upsert: hoisted.upsert },
        notificationsManager: { has: hoisted.notificationsHas, recordIfNew: hoisted.recordIfNew }
    })
}));

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: hoisted.sendChannelMessagePayload }));
vi.mock('../status.js', () => ({ recordJobRun: hoisted.recordJobRun }));

function makeQueue() {
    return {
        handlers: new Map<string, (job: { data: unknown; done: () => Promise<void> | void }) => Promise<void>>(),
        on(name: string, handler: (job: { data: unknown; done: () => Promise<void> | void }) => Promise<void>) { this.handlers.set(name, handler); },
        async start() {},
        async schedule() { return 'id'; }
    };
}

function makeCfg(extra?: Record<string, unknown>) {
    return { id: 'b1', guildId: 'g1', discordChannelId: 'chan1', blueskyHandle: 'bsky.app', lastPostUri: null as string | null, lastPostCid: null as string | null, ...extra };
}

function makeFeed(uri = 'at://did:plc:test/app.bsky.feed.post/abc', cid = 'cid1') {
    return {
        feed: [{
            post: {
                uri,
                cid,
                author: { did: 'did:plc:test', handle: 'bsky.app', displayName: 'Bluesky', avatar: 'https://example.com/avatar.jpg' },
                record: { text: 'Hello Bluesky', createdAt: '2026-01-01T00:00:00Z' },
                likeCount: 1,
                repostCount: 2,
                replyCount: 3,
                indexedAt: '2026-01-01T00:00:01Z',
            }
        }]
    };
}

async function runOnce() {
    const q = makeQueue();
    await registerBlueskyJobs(q as never, new Date('2025-01-01T00:00:00Z'));
    const handler = q.handlers.get('bluesky:poll');
    if (!handler) throw new Error('missing bluesky handler');
    const done = vi.fn();
    await handler({ data: {}, done });
    return { done };
}

describe('bluesky job branches', () => {
    beforeEach(() => {
        hoisted.getAllAccounts.mockReset();
        hoisted.upsert.mockReset();
        hoisted.notificationsHas.mockReset();
        hoisted.recordIfNew.mockReset();
        hoisted.sendChannelMessagePayload.mockReset();
        hoisted.recordJobRun.mockReset();
        hoisted.notificationsHas.mockResolvedValue(false);
        hoisted.sendChannelMessagePayload.mockResolvedValue({ id: 'msg1' });
        hoisted.upsert.mockResolvedValue(false);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => makeFeed(),
            text: async () => '',
        } as unknown as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('announces a new post and persists the latest pointer', async () => {
        const cfg = makeCfg({ customMessage: 'Post from {author}: {text}' });
        hoisted.getAllAccounts.mockResolvedValue([cfg]);

        const { done } = await runOnce();

        expect(done).toHaveBeenCalled();
        expect(hoisted.sendChannelMessagePayload).toHaveBeenCalledTimes(1);
        const payload = hoisted.sendChannelMessagePayload.mock.calls[0]?.[1] as { content?: string };
        expect(payload.content).toContain('Post from Bluesky: Hello Bluesky');
        expect(payload.content).toContain('https://bsky.app/profile/bsky.app/post/abc');
        expect(hoisted.recordIfNew).toHaveBeenCalledWith({
            provider: 'bluesky',
            eventId: 'at://did:plc:test/app.bsky.feed.post/abc',
            channelId: 'chan1',
            guildId: 'g1',
        });
        expect(cfg.lastPostUri).toBe('at://did:plc:test/app.bsky.feed.post/abc');
        expect(cfg.lastPostCid).toBe('cid1');
        expect(hoisted.upsert).toHaveBeenCalled();
    });

    it('suppresses during quiet hours and still advances the pointer', async () => {
        const cfg = makeCfg({ quietHoursStart: '00:00', quietHoursEnd: '23:59' });
        hoisted.getAllAccounts.mockResolvedValue([cfg]);

        await runOnce();

        expect(hoisted.sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(cfg.lastPostUri).toBe('at://did:plc:test/app.bsky.feed.post/abc');
        expect(hoisted.upsert).toHaveBeenCalled();
    });

    it('does nothing when latest post is already stored', async () => {
        const cfg = makeCfg({ lastPostUri: 'at://did:plc:test/app.bsky.feed.post/abc' });
        hoisted.getAllAccounts.mockResolvedValue([cfg]);

        await runOnce();

        expect(hoisted.sendChannelMessagePayload).not.toHaveBeenCalled();
        expect(hoisted.upsert).not.toHaveBeenCalled();
    });
});
