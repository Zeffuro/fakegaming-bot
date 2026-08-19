import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    RolePermissionSnapshot,
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

    afterEach(async () => {
        delete process.env.ROLE_PERMISSION_SNAPSHOT_RETENTION;
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

    it('enforces per-guild retention and supports guild-scoped deletion', async () => {
        process.env.ROLE_PERMISSION_SNAPSHOT_RETENTION = '2';
        const first = await manager.createSnapshot({ guildId: snapshot.guild.id, guildName: snapshot.guild.name, createdById: 'admin-1', snapshot });
        const second = await manager.createSnapshot({ guildId: snapshot.guild.id, guildName: snapshot.guild.name, createdById: 'admin-1', snapshot });
        const third = await manager.createSnapshot({ guildId: snapshot.guild.id, guildName: snapshot.guild.name, createdById: 'admin-1', snapshot });

        expect(await manager.listSnapshots(snapshot.guild.id, 10)).toHaveLength(2);
        await expect(manager.getSnapshot(snapshot.guild.id, first.id)).resolves.toBeNull();
        await expect(manager.deleteSnapshot('other-guild', second.id)).resolves.toBe(false);
        await expect(manager.deleteSnapshot(snapshot.guild.id, second.id)).resolves.toBe(true);
        await expect(manager.getSnapshot(snapshot.guild.id, third.id)).resolves.not.toBeNull();
    });

    it('physically redacts valid v2 member profiles and surfaces invalid stored rows', async () => {
        const legacy = await RolePermissionSnapshot.create({
            guildId: snapshot.guild.id,
            guildName: snapshot.guild.name,
            createdById: 'admin-1',
            snapshot: legacySnapshot() as never,
        });

        await expect(manager.redactLegacySnapshots()).resolves.toBe(1);
        const raw = await RolePermissionSnapshot.findByPk(legacy.id, { raw: true });
        const stored = typeof raw?.snapshot === 'string'
            ? JSON.parse(raw.snapshot) as Record<string, unknown>
            : raw?.snapshot as unknown as Record<string, unknown>;
        const serialized = JSON.stringify(stored);
        expect(stored.version).toBe(ROLE_PERMISSION_SNAPSHOT_VERSION);
        expect(serialized).not.toContain('Private Name');
        expect(serialized).not.toContain('private-user');

        const invalid = await RolePermissionSnapshot.create({
            guildId: snapshot.guild.id,
            guildName: snapshot.guild.name,
            createdById: 'admin-1',
            snapshot: { version: 99 } as never,
        });
        await expect(manager.redactLegacySnapshots()).rejects.toThrow(`snapshot #${invalid.id} is invalid`);
    });
});

function legacySnapshot(): unknown {
    return {
        ...snapshot,
        version: 2,
        roles: snapshot.roles.map(role => ({
            ...role,
            members: role.members.map(member => ({
                ...member,
                username: 'private-user',
                globalName: 'Private Name',
                displayName: 'Private Name',
                nickname: 'Private Name',
            })),
        })),
    };
}
