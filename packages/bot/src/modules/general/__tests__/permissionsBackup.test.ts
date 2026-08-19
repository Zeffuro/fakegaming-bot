import { describe, expect, it, vi } from 'vitest';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import type { RolePermissionSnapshotData } from '@zeffuro/fakegaming-common/models';

function createRoleGuild(memberFetch: ReturnType<typeof vi.fn>) {
    const member = {
        id: 'member-1',
        user: {
            username: 'member-one',
            globalName: 'Member One',
        },
        displayName: 'Member One',
        nickname: 'M1',
    };
    const members = new Map([[member.id, member]]);
    const role = {
        id: 'role-1',
        name: 'Administrators',
        position: 10,
        color: 0x00ff00,
        hexColor: '#00ff00',
        managed: false,
        hoist: true,
        mentionable: false,
        permissions: {
            toArray: () => ['ManageGuild', 'Administrator'],
            bitfield: 8n,
        },
        members,
    };
    const category = {
        id: 'category-1',
        name: 'Staff',
        type: 4,
        rawPosition: 1,
        parentId: null as string | null,
        isThread: () => false,
        permissionOverwrites: {
            cache: new Map([[role.id, {
                id: role.id,
                type: 0,
                allow: { bitfield: 8n },
                deny: { bitfield: 0n },
            }]]),
        },
    };
    const channel = {
        id: 'channel-1',
        name: 'staff-chat',
        type: 0,
        rawPosition: 2,
        parentId: category.id,
        isThread: () => false,
        permissionOverwrites: { cache: new Map() },
    };
    const channels = new Map([[category.id, category], [channel.id, channel]]);

    return {
        id: 'guild-1',
        name: 'Permission Test Guild',
        memberCount: 1,
        members: {
            cache: members,
            fetch: memberFetch,
        },
        roles: {
            cache: new Map([[role.id, role]]),
            fetch: vi.fn().mockResolvedValue(new Map([[role.id, role]])),
        },
        channels: {
            cache: channels,
            fetch: vi.fn().mockResolvedValue(channels),
        },
    };
}

describe('permissions-backup command', () => {
    it('saves and exports a snapshot with fetched role members', async () => {
        const memberFetch = vi.fn();
        const guild = createRoleGuild(memberFetch);
        memberFetch.mockResolvedValue(guild.members.cache);
        const createSnapshot = vi.fn().mockResolvedValue({ id: 7 });

        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/permissionsBackup.js',
            {
                managerOverrides: {
                    rolePermissionSnapshotManager: { createSnapshot },
                },
                interaction: {
                    guild,
                    guildId: guild.id,
                    subcommand: 'create',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect((interaction as ChatInputCommandInteraction).memberPermissions?.has)
            .toHaveBeenCalledWith(PermissionFlagsBits.Administrator);
        expect(createSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            guildId: guild.id,
            guildName: guild.name,
            snapshot: expect.objectContaining({
                memberData: {
                    source: 'fetched',
                    capturedMemberCount: 1,
                    fetchFailed: false,
                },
                roleData: {
                    source: 'fetched',
                    capturedRoleCount: 1,
                    fetchFailed: false,
                },
                channelData: {
                    source: 'fetched',
                    capturedChannelCount: 2,
                    fetchFailed: false,
                },
                roles: [expect.objectContaining({
                    id: 'role-1',
                    permissions: ['Administrator'],
                    members: [expect.objectContaining({ id: 'member-1' })],
                })],
                channels: expect.arrayContaining([expect.objectContaining({
                    id: 'category-1',
                    kind: 'category',
                    permissionOverwrites: [expect.objectContaining({ allowPermissions: ['Administrator'] })],
                })]),
            }),
        }));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('Saved permission snapshot #7'),
            files: expect.any(Array),
        }));
    });

    it('records cached member coverage when Discord refuses member fetching', async () => {
        const memberFetch = vi.fn().mockRejectedValue(new Error('Missing privileged intent'));
        const guild = createRoleGuild(memberFetch);
        const createSnapshot = vi.fn().mockResolvedValue({ id: 8 });

        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/permissionsBackup.js',
            {
                managerOverrides: {
                    rolePermissionSnapshotManager: { createSnapshot },
                },
                interaction: {
                    guild,
                    guildId: guild.id,
                    subcommand: 'create',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(createSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            snapshot: expect.objectContaining({
                memberData: {
                    source: 'cache',
                    capturedMemberCount: 1,
                    fetchFailed: true,
                },
            }),
        }));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('cached members were used'),
        }));
    });

    it('exports a saved snapshot without reading the current guild state', async () => {
        const snapshot: RolePermissionSnapshotData = {
            version: 2,
            capturedAt: '2026-08-19T10:00:00.000Z',
            guild: { id: 'guild-1', name: 'Permission Test Guild', memberCount: 1 },
            roleData: { source: 'fetched', capturedRoleCount: 0, fetchFailed: false },
            memberData: { source: 'fetched', capturedMemberCount: 1, fetchFailed: false },
            channelData: { source: 'fetched', capturedChannelCount: 0, fetchFailed: false },
            roles: [],
            channels: [],
        };
        const getSnapshot = vi.fn().mockResolvedValue({ id: 9, snapshot });

        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/permissionsBackup.js',
            {
                managerOverrides: {
                    rolePermissionSnapshotManager: { getSnapshot },
                },
                interaction: {
                    guildId: snapshot.guild.id,
                    subcommand: 'export',
                    integerOptions: { id: 9 },
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getSnapshot).toHaveBeenCalledWith(snapshot.guild.id, 9);
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('Permission snapshot #9'),
            files: expect.any(Array),
        }));
    });

    it('denies non-administrators before accessing snapshots', async () => {
        const { command, interaction, configManager } = await setupCommandTest(
            'modules/general/commands/permissionsBackup.js',
            {
                interaction: {
                    subcommand: 'list',
                    memberPermissions: { has: vi.fn().mockReturnValue(false) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(configManager.rolePermissionSnapshotManager.listSnapshots).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Only server administrators can access permission backups.',
        }));
    });
});
