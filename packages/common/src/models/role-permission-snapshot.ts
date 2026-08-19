import { AutoIncrement, Column, DataType, Default, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

export const ROLE_PERMISSION_SNAPSHOT_VERSION = 2;

export type RolePermissionSnapshotSource = 'fetched' | 'cache' | 'unavailable';

export type RolePermissionSnapshotChannelKind =
    | 'category'
    | 'text'
    | 'announcement'
    | 'voice'
    | 'stage'
    | 'forum'
    | 'media'
    | 'unknown';

export type RolePermissionSnapshotOverwriteType = 'role' | 'member' | 'unknown';

export interface RolePermissionSnapshotMember {
    id: string;
    username: string;
    globalName: string | null;
    displayName: string;
    nickname: string | null;
}

export interface RolePermissionSnapshotRole {
    id: string;
    name: string;
    position: number;
    color: number;
    hexColor: string;
    managed: boolean;
    hoist: boolean;
    mentionable: boolean;
    permissions: string[];
    permissionsBitfield: string;
    members: RolePermissionSnapshotMember[];
}

export interface RolePermissionSnapshotPermissionOverwrite {
    id: string;
    type: RolePermissionSnapshotOverwriteType;
    allow: string;
    deny: string;
    allowPermissions: string[];
    denyPermissions: string[];
}

export interface RolePermissionSnapshotChannel {
    id: string;
    name: string;
    kind: RolePermissionSnapshotChannelKind;
    channelType: number;
    position: number;
    parentId: string | null;
    permissionOverwrites: RolePermissionSnapshotPermissionOverwrite[];
}

export interface RolePermissionSnapshotData {
    version: number;
    capturedAt: string;
    guild: {
        id: string;
        name: string;
        memberCount: number;
    };
    roleData: {
        source: RolePermissionSnapshotSource;
        capturedRoleCount: number;
        fetchFailed: boolean;
    };
    memberData: {
        source: RolePermissionSnapshotSource;
        capturedMemberCount: number;
        fetchFailed: boolean;
    };
    channelData: {
        source: RolePermissionSnapshotSource;
        capturedChannelCount: number;
        fetchFailed: boolean;
    };
    roles: RolePermissionSnapshotRole[];
    channels: RolePermissionSnapshotChannel[];
}

@Table({ tableName: 'RolePermissionSnapshots' })
export class RolePermissionSnapshot extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Index('idx_role_permission_snapshots_guild_created')
    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare guildName: string;

    @Column(DataType.STRING)
    declare createdById: string;

    @Column(DataType.JSON)
    declare snapshot: RolePermissionSnapshotData;

    @Default(DataType.NOW)
    @Index('idx_role_permission_snapshots_guild_created')
    @Column(DataType.DATE)
    declare createdAt: Date;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare updatedAt: Date;
}
