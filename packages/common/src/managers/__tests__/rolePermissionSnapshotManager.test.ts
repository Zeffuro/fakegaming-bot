import { beforeEach, describe, expect, it } from 'vitest';
import {
    ROLE_PERMISSION_SNAPSHOT_VERSION,
    type RolePermissionSnapshotData,
} from '../../models/role-permission-snapshot.js';
import { configManager } from '../../vitest.setup.js';

const snapshot: RolePermissionSnapshotData = {
    version: ROLE_PERMISSION_SNAPSHOT_VERSION,
    capturedAt: '2026-08-19T12:00:00.000Z',
    guild: {
        id: 'guild-1',
        name: 'Permission Test Guild',
        memberCount: 2,
    },
    roleData: {
        source: 'fetched',
        capturedRoleCount: 1,
        fetchFailed: false,
    },
    memberData: {
        source: 'fetched',
        capturedMemberCount: 2,
        fetchFailed: false,
    },
    channelData: {
        source: 'fetched',
        capturedChannelCount: 1,
        fetchFailed: false,
    },
    roles: [{
        id: 'role-1',
        name: 'Administrators',
        position: 10,
        color: 0,
        hexColor: '#000000',
        managed: false,
        hoist: true,
        mentionable: false,
        permissions: ['Administrator'],
        permissionsBitfield: '8',
        members: [{
            id: 'member-1',
            username: 'member-one',
            globalName: 'Member One',
            displayName: 'Member One',
            nickname: null,
        }],
    }],
    channels: [{
        id: 'channel-1',
        name: 'staff-chat',
        kind: 'text',
        channelType: 0,
        position: 1,
        parentId: null,
        permissionOverwrites: [{
            id: 'role-1',
            type: 'role',
            allow: '8',
            deny: '0',
            allowPermissions: ['Administrator'],
            denyPermissions: [],
        }],
    }],
};

describe('RolePermissionSnapshotManager', () => {
    const manager = configManager.rolePermissionSnapshotManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('saves, lists, and retrieves a guild-scoped historical snapshot', async () => {
        const saved = await manager.createSnapshot({
            guildId: snapshot.guild.id,
            guildName: snapshot.guild.name,
            createdById: 'admin-1',
            snapshot,
        });

        expect(saved.id).toBeGreaterThan(0);
        expect(saved.snapshot).toEqual(snapshot);

        const listed = await manager.listSnapshots(snapshot.guild.id, 10);
        expect(listed).toHaveLength(1);
        expect(listed[0]).toMatchObject({
            id: saved.id,
            guildId: snapshot.guild.id,
            createdById: 'admin-1',
            snapshot,
        });

        await expect(manager.getSnapshot(snapshot.guild.id, saved.id)).resolves.toMatchObject({
            id: saved.id,
            snapshot,
        });
        await expect(manager.getSnapshot('other-guild', saved.id)).resolves.toBeNull();
    });
});
