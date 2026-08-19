import { Routes, type Guild, type GuildBasedChannel, type Role } from 'discord.js';
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

interface DiscordChannelPayload {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    position?: unknown;
    parent_id?: unknown;
    permission_overwrites?: unknown;
}

interface DiscordPermissionOverwritePayload {
    id?: unknown;
    type?: unknown;
    allow?: unknown;
    deny?: unknown;
    allow_new?: unknown;
    deny_new?: unknown;
}

export async function captureRolePermissionSnapshot(guild: Guild): Promise<RolePermissionSnapshotData> {
    let roleSource: RolePermissionSnapshotData['roleData']['source'] = 'cache';
    let roleFetchFailed = false;
    let members = guild.members.cache;
    let source: RolePermissionSnapshotData['memberData']['source'] = 'cache';
    let fetchFailed = false;
    let channelSource: RolePermissionSnapshotData['channelData']['source'] = 'cache';
    let channelFetchFailed = false;
    let rawChannels: DiscordChannelPayload[] | null = null;

    try {
        await guild.roles.fetch();
        roleSource = 'fetched';
    } catch {
        roleFetchFailed = true;
    }

    try {
        const response = await guild.client.rest.get(Routes.guildChannels(guild.id));
        if (!Array.isArray(response)) throw new Error('Discord returned an invalid channel response.');
        rawChannels = response as DiscordChannelPayload[];
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
    const channels = (rawChannels
        ? rawChannels.map(channel => snapshotRawChannel(channel))
        : [...guild.channels.cache.values()].map(channel => snapshotCachedChannel(channel)))
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

function snapshotCachedChannel(channel: GuildBasedChannel): RolePermissionSnapshotChannel | null {
    if (channel.isThread() || !('permissionOverwrites' in channel)) return null;

    return {
        id: channel.id,
        name: channel.name,
        kind: rolePermissionChannelKind(channel.type),
        channelType: channel.type,
        position: channel.rawPosition,
        parentId: channel.parentId,
        permissionOverwrites: [...channel.permissionOverwrites.cache.values()]
            .map(overwrite => snapshotCachedPermissionOverwrite(overwrite))
            .sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id)),
    };
}

function snapshotCachedPermissionOverwrite(overwrite: {
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

function snapshotRawChannel(channel: DiscordChannelPayload): RolePermissionSnapshotChannel | null {
    const id = typeof channel.id === 'string' ? channel.id : null;
    const channelType = readInteger(channel.type);
    if (!id || isThreadChannel(channelType)) return null;

    return {
        id,
        name: readString(channel.name, id),
        kind: rolePermissionChannelKind(channelType),
        channelType,
        position: readInteger(channel.position),
        parentId: typeof channel.parent_id === 'string' ? channel.parent_id : null,
        permissionOverwrites: snapshotRawPermissionOverwrites(channel.permission_overwrites),
    };
}

function snapshotRawPermissionOverwrites(value: unknown): RolePermissionSnapshotPermissionOverwrite[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter((overwrite): overwrite is DiscordPermissionOverwritePayload => Boolean(overwrite && typeof overwrite === 'object'))
        .filter((overwrite): overwrite is DiscordPermissionOverwritePayload & { id: string } => typeof overwrite.id === 'string')
        .map(overwrite => {
            const allow = readPermissionBitfield(overwrite.allow_new, readPermissionBitfield(overwrite.allow, '0'));
            const deny = readPermissionBitfield(overwrite.deny_new, readPermissionBitfield(overwrite.deny, '0'));
            const overwriteType = typeof overwrite.type === 'string' || typeof overwrite.type === 'number' ? overwrite.type : -1;
            return {
                id: overwrite.id,
                type: rolePermissionOverwriteType(overwriteType),
                allow,
                deny,
                allowPermissions: permissionNamesFromBitfield(allow),
                denyPermissions: permissionNamesFromBitfield(deny),
            };
        })
        .sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
}

function isThreadChannel(channelType: number): boolean {
    return channelType === 10 || channelType === 11 || channelType === 12;
}

function readString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readInteger(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function readPermissionBitfield(value: unknown, fallback: string): string {
    if (typeof value === 'string' && /^\d+$/.test(value)) return value;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value.toString();
    return fallback;
}

function snapshotMember(member: { id: string }): RolePermissionSnapshotMember {
    return { id: member.id };
}
