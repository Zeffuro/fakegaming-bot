import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as common from '@zeffuro/fakegaming-common';
import { expectBadRequest, expectUnauthorized, seedUserGuilds, seedUserProfiles, seedUserGuildNick, expectOk } from '@zeffuro/fakegaming-common/testing';

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
    const guildId = 'testguild1';
    const authorId = '123';
    const submitterId = '456';

    const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

    beforeAll(() => {
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
    });

    beforeEach(async () => {
        // Seed user profiles and guild nick
        await seedUserProfiles([
            { id: authorId, username: `user_${authorId}`, global_name: null, discriminator: '0001', avatar: null },
            { id: submitterId, username: `user_${submitterId}`, global_name: null, discriminator: '0001', avatar: null },
            { id: '789', username: 'user_789', global_name: null, discriminator: '0001', avatar: null },
        ]);
        await seedUserGuildNick(authorId, guildId, 'AuthorNick');
        await seedUserGuildNick(submitterId, guildId, null);
        await seedUserGuildNick('789', guildId, null);

        // Ensure the test user has admin access to the guild under test
        await seedUserGuilds('testuser', [{ id: guildId, permissions: '8' }]);
    });

    it('resolves users', async () => {
        const res = await client.post('/api/discord/users/resolve', { guildId, ids: [authorId, submitterId, '789'] });
        expectOk(res);
        expect(Array.isArray(res.body.users)).toBe(true);
        const ids = res.body.users.map((u: any) => u.id);
        expect(ids).toContain(authorId);
        expect(ids).toContain(submitterId);
        expect(ids).toContain('789');
        expect(res.body.missed).toEqual([]);
    });

    it('returns 400 for invalid body', async () => {
        const res = await client.post('/api/discord/users/resolve', { guildId } as any);
        expectBadRequest(res);
    });

    it('returns 401 without JWT', async () => {
        const res = await client.raw
            .post('/api/discord/users/resolve')
            .send({ guildId, ids: [authorId] });
        expectUnauthorized(res);
    });

    it('returns empty arrays for empty ids', async () => {
        const res = await client.post('/api/discord/users/resolve', { guildId, ids: [] });
        expectOk(res);
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
        await common.defaultCacheManager.del(common.CACHE_KEYS.userProfile('999'));
        await common.defaultCacheManager.del(common.CACHE_KEYS.userGuildNick('999', guildId));

        const res = await client.post('/api/discord/users/resolve', { guildId, ids: ['999', authorId] });
        expectOk(res);
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
        const freshId = 'fresh1';
        const testCache: any = (globalThis as any).__testCacheManager ?? common.defaultCacheManager;
        // Clear from both caches in case instances differ
        await testCache.del(common.CACHE_KEYS.userProfile(freshId));
        await testCache.del(common.CACHE_KEYS.userGuildNick(freshId, guildId));
        if (testCache !== (common.defaultCacheManager as any)) {
            await common.defaultCacheManager.del(common.CACHE_KEYS.userProfile(freshId));
            await common.defaultCacheManager.del(common.CACHE_KEYS.userGuildNick(freshId, guildId));
        }

        spyUser.mockClear();
        spyMember.mockClear();

        const res1 = await client.post('/api/discord/users/resolve', { guildId, ids: [freshId] });
        expectOk(res1);
        const callsAfterFirst = { user: spyUser.mock.calls.length, member: spyMember.mock.calls.length };

        const res2 = await client.post('/api/discord/users/resolve', { guildId, ids: [freshId] });
        expectOk(res2);
        expect(spyUser.mock.calls.length).toBe(callsAfterFirst.user);
        expect(spyMember.mock.calls.length).toBe(callsAfterFirst.member);
    });
});