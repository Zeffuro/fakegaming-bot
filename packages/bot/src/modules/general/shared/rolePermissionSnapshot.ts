import type { Guild, GuildBasedChannel, GuildMember, Role } from 'discord.js';
import {
    ROLE_PERMISSION_SNAPSHOT_VERSION,
    type RolePermissionSnapshotChannel,
    type RolePermissionSnapshotData,
    type RolePermissionSnapshotMember,
    type RolePermissionSnapshotPermissionOverwrite,
    type RolePermissionSnapshotRole,
} from '@zeffuro/fakegaming-common/models';
import {
    permissionNamesFromBitfield,
    rolePermissionChannelKind,
    rolePermissionOverwriteType,
} from '@zeffuro/fakegaming-common/discord';

export async function captureRolePermissionSnapshot(guild: Guild): Promise<RolePermissionSnapshotData> {
    let roleSource: RolePermissionSnapshotData['roleData']['source'] = 'cache';
    let roleFetchFailed = false;
    let members = guild.members.cache;
    let source: RolePermissionSnapshotData['memberData']['source'] = 'cache';
    let fetchFailed = false;
    let channelSource: RolePermissionSnapshotData['channelData']['source'] = 'cache';
    let channelFetchFailed = false;

    try {
        await guild.roles.fetch();
        roleSource = 'fetched';
    } catch {
        roleFetchFailed = true;
    }

    try {
        await guild.channels.fetch();
        channelSource = 'fetched';
    } catch {
        channelFetchFailed = true;
    }

    try {
        members = await guild.members.fetch();
        source = 'fetched';
    } catch {
        fetchFailed = true;
    }

    const roles = [...guild.roles.cache.values()]
        .sort((left, right) => right.position - left.position || left.id.localeCompare(right.id))
        .map(role => snapshotRole(role));
    const channels = [...guild.channels.cache.values()]
        .map(channel => snapshotChannel(channel))
        .filter((channel): channel is RolePermissionSnapshotChannel => channel !== null)
        .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

    return {
        version: ROLE_PERMISSION_SNAPSHOT_VERSION,
        capturedAt: new Date().toISOString(),
        guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
        },
        roleData: {
            source: roleSource,
            capturedRoleCount: roles.length,
            fetchFailed: roleFetchFailed,
        },
        memberData: {
            source,
            capturedMemberCount: members.size,
            fetchFailed,
        },
        channelData: {
            source: channelSource,
            capturedChannelCount: channels.length,
            fetchFailed: channelFetchFailed,
        },
        roles,
        channels,
    };
}

function snapshotRole(role: Role): RolePermissionSnapshotRole {
    return {
        id: role.id,
        name: role.name,
        position: role.position,
        color: role.color,
        hexColor: role.hexColor,
        managed: role.managed,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: permissionNamesFromBitfield(role.permissions.bitfield),
        permissionsBitfield: role.permissions.bitfield.toString(),
        members: [...role.members.values()]
            .map(member => snapshotMember(member))
            .sort((left, right) => left.id.localeCompare(right.id)),
    };
}

function snapshotChannel(channel: GuildBasedChannel): RolePermissionSnapshotChannel | null {
    if (channel.isThread() || !('permissionOverwrites' in channel)) return null;

    return {
        id: channel.id,
        name: channel.name,
        kind: rolePermissionChannelKind(channel.type),
        channelType: channel.type,
        position: channel.rawPosition,
        parentId: channel.parentId,
        permissionOverwrites: [...channel.permissionOverwrites.cache.values()]
            .map(overwrite => snapshotPermissionOverwrite(overwrite))
            .sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id)),
    };
}

function snapshotPermissionOverwrite(overwrite: {
    id: string;
    type: number;
    allow: { bitfield: bigint };
    deny: { bitfield: bigint };
}): RolePermissionSnapshotPermissionOverwrite {
    return {
        id: overwrite.id,
        type: rolePermissionOverwriteType(overwrite.type),
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString(),
        allowPermissions: permissionNamesFromBitfield(overwrite.allow.bitfield),
        denyPermissions: permissionNamesFromBitfield(overwrite.deny.bitfield),
    };
}

function snapshotMember(member: GuildMember): RolePermissionSnapshotMember {
    return {
        id: member.id,
        username: member.user.username,
        globalName: member.user.globalName,
        displayName: member.displayName,
        nickname: member.nickname,
    };
}
