import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import * as Discord from '@zeffuro/fakegaming-common/discord';
import type { RolePermissionSnapshotData } from '@zeffuro/fakegaming-common/models';
import { expectCreated, expectNotFound, expectOk } from '@zeffuro/fakegaming-common/testing';

const client = givenAuthenticatedClient(app, { discordId: 'testuser' });
const guildId = 'testguild1';

const savedSnapshot: RolePermissionSnapshotData = {
    version: 2,
    capturedAt: '2026-08-19T10:00:00.000Z',
    guild: { id: guildId, name: 'Test Guild', memberCount: 1 },
    roleData: { source: 'fetched', capturedRoleCount: 1, fetchFailed: false },
    memberData: { source: 'fetched', capturedMemberCount: 1, fetchFailed: false },
    channelData: { source: 'fetched', capturedChannelCount: 1, fetchFailed: false },
    roles: [{
        id: guildId,
        name: '@everyone',
        position: 0,
        color: 0,
        hexColor: '#000000',
        managed: false,
        hoist: false,
        mentionable: false,
        permissions: ['ViewChannel'],
        permissionsBitfield: '1024',
        members: [{
            id: 'member-1',
            username: 'member',
            globalName: 'Member',
            displayName: 'Member',
            nickname: null,
        }],
    }],
    channels: [{
        id: 'category-1',
        name: 'Category',
        kind: 'category',
        channelType: 4,
        position: 0,
        parentId: null,
        permissionOverwrites: [{
            id: guildId,
            type: 'role',
            allow: '1024',
            deny: '0',
            allowPermissions: ['ViewChannel'],
            denyPermissions: [],
        }],
    }],
};

describe('Role permission snapshots API', () => {
    beforeEach(async () => {
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
        await configManager.rolePermissionSnapshotManager.removeAll();
    });

    afterEach(() => {
        delete process.env.DISCORD_BOT_TOKEN;
    });

    it('lists and retrieves only snapshots for the requested guild', async () => {
        const created = await configManager.rolePermissionSnapshotManager.createSnapshot({
            guildId,
            guildName: 'Test Guild',
            createdById: 'testuser',
            snapshot: savedSnapshot,
        });
        const other = await configManager.rolePermissionSnapshotManager.createSnapshot({
            guildId: 'testguild2',
            guildName: 'Other Guild',
            createdById: 'testuser',
            snapshot: { ...savedSnapshot, guild: { ...savedSnapshot.guild, id: 'testguild2' } },
        });

        const list = await client.get('/api/rolePermissionSnapshots').query({ guildId });
        expectOk(list);
        expect(list.body.snapshots).toHaveLength(1);
        expect(list.body.snapshots[0]).toMatchObject({ id: created.id, guildId, snapshot: savedSnapshot });

        const found = await client.get(`/api/rolePermissionSnapshots/${created.id}`).query({ guildId });
        expectOk(found);
        expect(found.body.snapshot).toMatchObject({ id: created.id, snapshot: savedSnapshot });

        const hiddenFromOtherGuild = await client.get(`/api/rolePermissionSnapshots/${other.id}`).query({ guildId });
        expectNotFound(hiddenFromOtherGuild);
    });

    it('reads and saves the live role, member, category, and channel permission state', async () => {
        const retryFetchJson = vi.spyOn(Discord, 'retryFetchJson');
        retryFetchJson.mockImplementation(async ({ url }: { url: string }) => {
            if (url.endsWith(`/guilds/${guildId}`)) {
                return { id: guildId, name: 'Live Guild', approximate_member_count: 1 };
            }
            if (url.endsWith('/roles')) {
                return [
                    { id: guildId, name: '@everyone', position: 0, color: 0, permissions: '1024', managed: false, hoist: false, mentionable: false },
                    { id: 'role-1', name: 'Moderators', position: 2, color: 16711680, permissions: '8', managed: false, hoist: true, mentionable: true },
                ];
            }
            if (url.endsWith('/channels')) {
                return [
                    {
                        id: 'category-1',
                        name: 'Staff',
                        type: 4,
                        position: 1,
                        parent_id: null,
                        permission_overwrites: [{ id: 'role-1', type: 0, allow: '1024', deny: '0' }],
                    },
                    {
                        id: 'channel-1',
                        name: 'mod-chat',
                        type: 0,
                        position: 2,
                        parent_id: 'category-1',
                        permission_overwrites: [{ id: 'member-1', type: 1, allow: '0', deny: '2048' }],
                    },
                ];
            }
            if (url.includes('/members?')) {
                return [{
                    user: { id: 'member-1', username: 'alice', global_name: 'Alice' },
                    nick: 'Ali',
                    roles: ['role-1'],
                }];
            }
            throw new Error(`Unexpected Discord URL: ${url}`);
        });

        const live = await client.get('/api/rolePermissionSnapshots/live').query({ guildId });
        expectOk(live);
        expect(live.headers['cache-control']).toBe('private, no-store');
        expect(live.body.snapshot).toMatchObject({
            version: 2,
            guild: { id: guildId, name: 'Live Guild', memberCount: 1 },
            roleData: { source: 'fetched', capturedRoleCount: 2, fetchFailed: false },
            memberData: { source: 'fetched', capturedMemberCount: 1, fetchFailed: false },
            channelData: { source: 'fetched', capturedChannelCount: 2, fetchFailed: false },
        });
        expect(live.body.snapshot.roles).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'role-1',
                permissions: ['Administrator'],
                members: [expect.objectContaining({ id: 'member-1', displayName: 'Ali' })],
            }),
        ]));
        expect(live.body.snapshot.channels).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'category-1',
                kind: 'category',
                permissionOverwrites: [expect.objectContaining({
                    id: 'role-1', type: 'role', allowPermissions: ['ViewChannel'],
                })],
            }),
            expect.objectContaining({
                id: 'channel-1',
                parentId: 'category-1',
                permissionOverwrites: [expect.objectContaining({
                    id: 'member-1', type: 'member', denyPermissions: ['SendMessages'],
                })],
            }),
        ]));

        const saved = await client.post('/api/rolePermissionSnapshots/live').query({ guildId });
        expectCreated(saved);
        expect(saved.body.snapshot).toMatchObject({ guildId, createdById: 'testuser' });
        expect(saved.body.snapshot.snapshot.channels).toHaveLength(2);
        expect(await configManager.rolePermissionSnapshotManager.listSnapshots(guildId)).toHaveLength(1);
    });
});
