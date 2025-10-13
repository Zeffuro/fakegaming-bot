import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { defaultCacheManager, CACHE_KEYS, CACHE_TTL } from '@zeffuro/fakegaming-common';
import * as common from '@zeffuro/fakegaming-common';

const spyUser = vi.spyOn(common, 'getDiscordUserById').mockImplementation(async (id: string) => ({
    id,
    username: `user_${id}`,
    global_name: null,
    discriminator: '0001',
    avatar: null
} as any));

const spyMember = vi.spyOn(common, 'getDiscordGuildMember').mockImplementation(async (_gid: string, id: string) => ({
    user: { id },
    nick: id === '123' ? 'AuthorNick' : null // hardcode authorId since it's not in scope yet
} as any));

import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';

describe('Discord resolve users API', () => {
    // Use a guild ID that is already seeded with admin rights in vitest.setup.ts
    const guildId = 'testguild1';
    const authorId = '123';
    const submitterId = '456';

    const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

    beforeAll(() => {
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
    });

    beforeEach(async () => {
        // Seed cache to ensure lookups succeed without external calls
        const seedIds = [authorId, submitterId, '789'];
        const testCache = (globalThis as any).__testCacheManager ?? defaultCacheManager;
        for (const id of seedIds) {
            await testCache.set(
                CACHE_KEYS.userProfile(id),
                {
                    id,
                    username: `user_${id}`,
                    global_name: null,
                    discriminator: '0001',
                    avatar: null
                },
                CACHE_TTL.USER_PROFILE
            );
            const nick = id === authorId ? 'AuthorNick' : null;
            await testCache.set(
                CACHE_KEYS.userGuildNick(id, guildId),
                nick,
                CACHE_TTL.USER_PROFILE
            );
        }
    });

    it('resolves users', async () => {
        const res = await client.post('/api/discord/users/resolve', { guildId, ids: [authorId, submitterId, '789'] });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.users)).toBe(true);
        const ids = res.body.users.map((u: any) => u.id);
        expect(ids).toContain(authorId);
        expect(ids).toContain(submitterId);
        expect(ids).toContain('789');
        expect(res.body.missed).toEqual([]);
    });

    it('returns 400 for invalid body', async () => {
        const res = await client.post('/api/discord/users/resolve', { guildId } as any);
        expect(res.status).toBe(400);
    });

    it('returns 401 without JWT', async () => {
        const res = await client.raw
            .post('/api/discord/users/resolve')
            .send({ guildId, ids: [authorId] });
        expect(res.status).toBe(401);
    });

    it('returns empty arrays for empty ids', async () => {
        const res = await client.post('/api/discord/users/resolve', { guildId, ids: [] });
        expect(res.status).toBe(200);
        expect(res.body.users).toEqual([]);
        expect(res.body.missed).toEqual([]);
    });

    it('marks partial misses when a user fetch fails', async () => {
        spyUser.mockImplementation(async (id: string) => {
            if (id === '999') {
                throw new Error('not found');
            }
            return {
                id,
                username: `user_${id}`,
                global_name: null,
                discriminator: '0001',
                avatar: null
            } as any;
        });
        // Clear any cache entries for 999 to force fetch
        const testCache = (globalThis as any).__testCacheManager ?? defaultCacheManager;
        await testCache.del(CACHE_KEYS.userProfile('999'));
        await testCache.del(CACHE_KEYS.userGuildNick('999', guildId));

        const res = await client.post('/api/discord/users/resolve', { guildId, ids: ['999', authorId] });
        expect(res.status).toBe(200);
        const uMap = new Map(res.body.users.map((u: any) => [u.id, u]));
        expect(uMap.get('999')).toBeTruthy();
        expect(res.body.missed).toContain('999');

        // Restore default behavior
        spyUser.mockImplementation(async (id: string) => ({
            id,
            username: `user_${id}`,
            global_name: null,
            discriminator: '0001',
            avatar: null
        } as any));
    });

    it('uses cache on subsequent calls (no extra Discord calls)', async () => {
        // Ensure no cache for a fresh id so first call fetches
        const freshId = 'fresh1';
        const testCache = (globalThis as any).__testCacheManager ?? defaultCacheManager;
        await testCache.del(CACHE_KEYS.userProfile(freshId));
        await testCache.del(CACHE_KEYS.userGuildNick(freshId, guildId));

        // Clear any previous spy calls from other tests
        spyUser.mockClear();
        spyMember.mockClear();

        // First call should fetch and populate cache
        const res1 = await client.post('/api/discord/users/resolve', { guildId, ids: [freshId] });

        expect(res1.status).toBe(200);
        const callsAfterFirst = { user: spyUser.mock.calls.length, member: spyMember.mock.calls.length };
        expect(callsAfterFirst.user).toBeGreaterThanOrEqual(1);

        // Second call should hit cache; no additional fetches
        const res2 = await client.post('/api/discord/users/resolve', { guildId, ids: [freshId] });
        expect(res2.status).toBe(200);
        expect(spyUser.mock.calls.length).toBe(callsAfterFirst.user);
        expect(spyMember.mock.calls.length).toBe(callsAfterFirst.member);
    });
});