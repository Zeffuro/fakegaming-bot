import { describe, it, expect, beforeAll, vi, afterEach, beforeEach } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import * as common from '@zeffuro/fakegaming-common';
import { clearMemberSearchRateLimitsForTest } from '../utils/memberSearchLimiter.js';

const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

const guildId = 'testguild1';

describe('Discord guild member search API', () => {
    beforeAll(() => {
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
    });

    beforeEach(() => {
        clearMemberSearchRateLimitsForTest();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns mapped results from Discord API and caches them', async () => {
        const spy = vi.spyOn(common.Discord, 'retryFetchJson').mockResolvedValueOnce([
            { user: { id: '100', username: 'alice', global_name: 'Alice', discriminator: '0001', avatar: null }, nick: 'Ali' },
            { user: { id: '200', username: 'bob', global_name: null, discriminator: '0002', avatar: 'hash' }, nick: null }
        ] as any);

        const res1 = await client.get(`/api/discord/guilds/${guildId}/members/search`).query({ query: 'a', limit: '5' });
        expect(res1.status).toBe(200);
        expect(Array.isArray(res1.body)).toBe(true);
        expect(res1.body.length).toBe(2);
        const callsAfterFirst = spy.mock.calls.length;

        const res2 = await client.get(`/api/discord/guilds/${guildId}/members/search`).query({ query: 'a', limit: '5' });
        expect(res2.status).toBe(200);
        expect(spy.mock.calls.length).toBe(callsAfterFirst);
    });

    it('enforces simple rate limiting per user+guild', async () => {
        vi.spyOn(common.Discord, 'retryFetchJson').mockResolvedValue([] as any);
        let lastStatus = 200;
        for (let i = 0; i < 11; i++) {
            const res = await client.get(`/api/discord/guilds/${guildId}/members/search`).query({ query: 'x' });
            lastStatus = res.status;
        }
        expect(lastStatus).toBe(429);
    });

    it('falls back to recent quote participants and cached profiles when Discord fails', async () => {
        vi.spyOn(common.Discord, 'retryFetchJson').mockRejectedValue(new Error('rate limited'));
        await common.getConfigManager().quoteManager.addPlain({ id: 'q_fb', guildId, quote: 'hello', authorId: '300', submitterId: '400', timestamp: Date.now() } as any);

        const testCache = (globalThis as any).__testCacheManager ?? common.defaultCacheManager;
        await testCache.set(common.CACHE_KEYS.userProfile('300'), { id: '300', username: 'charlie', global_name: 'Charles', discriminator: '0003', avatar: null }, common.CACHE_TTL.USER_PROFILE);
        await testCache.set(common.CACHE_KEYS.userGuildNick('300', guildId), 'Chuck', common.CACHE_TTL.USER_PROFILE);

        const res = await client.get(`/api/discord/guilds/${guildId}/members/search`).query({ query: 'chu' });
        expect(res.status).toBe(200);
        const ids = res.body.map((m: any) => m.id);
        expect(ids).toContain('300');
    });
});
