import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
    CACHE_KEYS,
    CACHE_TTL,
    type CacheManager,
} from '@zeffuro/fakegaming-common';
import {
    expectForbidden,
    expectOk,
    expectServiceUnavailable,
    signTestJwt,
} from '@zeffuro/fakegaming-common/testing';

interface MutableCacheManager extends CacheManager {
    clear?: () => void;
}

function getTestCache(): MutableCacheManager {
    return (globalThis as { __testCacheManager?: MutableCacheManager }).__testCacheManager ?? {
        get: async () => null,
        set: async () => undefined,
        del: async () => undefined,
        getCachedData: async () => null,
        clearUserCache: async () => undefined,
    };
}

describe('guild access cache fallback', () => {
    let token: string;

    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });

    beforeEach(async () => {
        vi.unstubAllGlobals();
        const cache = getTestCache();
        await cache.del(CACHE_KEYS.userAccessToken('testuser'));
    });

    it('refreshes Discord guilds on cold guild cache when an access token is cached', async () => {
        const cache = getTestCache();
        await cache.del(CACHE_KEYS.userGuilds('testuser'));
        await cache.set(CACHE_KEYS.userAccessToken('testuser'), 'discord-access-token', CACHE_TTL.ACCESS_TOKEN);

        const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe('https://discord.com/api/users/@me/guilds');
            expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer discord-access-token');
            return new Response(JSON.stringify([
                { id: 'freshguild', owner: false, permissions: '8' },
            ]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        vi.stubGlobal('fetch', fetchSpy);

        const res = await request(app)
            .get('/api/notifications/guild/freshguild?days=1')
            .set('Authorization', `Bearer ${token}`);

        expectOk(res);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        await expect(cache.get(CACHE_KEYS.userGuilds('testuser'))).resolves.toEqual([
            { id: 'freshguild', owner: false, permissions: '8' },
        ]);
    });

    it('returns a retryable degraded response when guild access cache is unavailable', async () => {
        const cache = getTestCache();
        const originalGet = cache.get.bind(cache);
        cache.get = async () => {
            throw new Error('redis down');
        };

        try {
            const res = await request(app)
                .get('/api/notifications/guild/testguild1?days=1')
                .set('Authorization', `Bearer ${token}`);

            expectServiceUnavailable(res);
            expect(res.body.error).toMatchObject({
                code: 'GUILD_ACCESS_UNAVAILABLE',
                recovery: 'Refresh the dashboard session, then retry the request.',
            });
        } finally {
            cache.get = originalGet;
        }
    });

    it('keeps real guild access denial as forbidden', async () => {
        const cache = getTestCache();
        await cache.set(CACHE_KEYS.userGuilds('testuser'), [
            { id: 'otherguild', permissions: '8' },
        ], CACHE_TTL.USER_GUILDS);

        const res = await request(app)
            .get('/api/notifications/guild/testguild1?days=1')
            .set('Authorization', `Bearer ${token}`);

        expectForbidden(res);
    });
});
