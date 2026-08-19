import { z } from 'zod';
import {
    ROLE_PERMISSION_SNAPSHOT_VERSION,
    type RolePermissionSnapshotData,
    type RolePermissionSnapshotChannelKind,
    type RolePermissionSnapshotOverwriteType,
} from '../models/role-permission-snapshot.js';

const snapshotSourceSchema = z.enum(['fetched', 'cache', 'unavailable']);
const decimalBitfieldSchema = z.string().regex(/^\d+$/);
const timestampSchema = z.string().refine(value => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}, 'Expected a canonical ISO timestamp.');
const memberIdSchema = z.object({ id: z.string().min(1).max(255) }).strict();
const legacyMemberSchema = z.object({
    id: z.string().min(1).max(255),
    username: z.string(),
    globalName: z.string().nullable(),
    displayName: z.string(),
    nickname: z.string().nullable(),
}).strict();
const overwriteSchema = z.object({
    id: z.string().min(1).max(255),
    type: z.enum(['role', 'member', 'unknown']),
    allow: decimalBitfieldSchema,
    deny: decimalBitfieldSchema,
    allowPermissions: z.array(z.string()),
    denyPermissions: z.array(z.string()),
}).strict();
const channelSchema = z.object({
    id: z.string().min(1).max(255),
    name: z.string(),
    kind: z.enum(['category', 'text', 'announcement', 'voice', 'stage', 'forum', 'media', 'unknown']),
    channelType: z.number().int(),
    position: z.number().int(),
    parentId: z.string().nullable(),
    permissionOverwrites: z.array(overwriteSchema),
}).strict();
const coverageBaseShape = {
    source: snapshotSourceSchema,
    fetchFailed: z.boolean(),
};
const roleCoverageSchema = z.object({
    ...coverageBaseShape,
    capturedRoleCount: z.number().int().nonnegative(),
}).strict();
const memberCoverageSchema = z.object({
    ...coverageBaseShape,
    capturedMemberCount: z.number().int().nonnegative(),
}).strict();
const channelCoverageSchema = z.object({
    ...coverageBaseShape,
    capturedChannelCount: z.number().int().nonnegative(),
}).strict();
const baseSnapshotShape = {
    capturedAt: timestampSchema,
    guild: z.object({
        id: z.string().min(1).max(255),
        name: z.string(),
        memberCount: z.number().int().nonnegative(),
    }).strict(),
    roleData: roleCoverageSchema,
    memberData: memberCoverageSchema,
    channelData: channelCoverageSchema,
    channels: z.array(channelSchema),
};
const roleBaseShape = {
    id: z.string().min(1).max(255),
    name: z.string(),
    position: z.number().int(),
    color: z.number().int().nonnegative(),
    hexColor: z.string(),
    managed: z.boolean(),
    hoist: z.boolean(),
    mentionable: z.boolean(),
    permissions: z.array(z.string()),
    permissionsBitfield: decimalBitfieldSchema,
};
const snapshotV3Schema = z.object({
    version: z.literal(3),
    ...baseSnapshotShape,
    roles: z.array(z.object({ ...roleBaseShape, members: z.array(memberIdSchema) }).strict()),
}).strict();
const snapshotV2Schema = z.object({
    version: z.literal(2),
    ...baseSnapshotShape,
    roles: z.array(z.object({ ...roleBaseShape, members: z.array(legacyMemberSchema) }).strict()),
}).strict();

export interface NormalizedRolePermissionSnapshot {
    snapshot: RolePermissionSnapshotData;
    sourceVersion: 2 | typeof ROLE_PERMISSION_SNAPSHOT_VERSION;
}

const DISCORD_PERMISSION_FLAGS: ReadonlyArray<readonly [string, bigint]> = [
    ['CreateInstantInvite', 1n << 0n],
    ['KickMembers', 1n << 1n],
    ['BanMembers', 1n << 2n],
    ['Administrator', 1n << 3n],
    ['ManageChannels', 1n << 4n],
    ['ManageGuild', 1n << 5n],
    ['AddReactions', 1n << 6n],
    ['ViewAuditLog', 1n << 7n],
    ['PrioritySpeaker', 1n << 8n],
    ['Stream', 1n << 9n],
    ['ViewChannel', 1n << 10n],
    ['SendMessages', 1n << 11n],
    ['SendTTSMessages', 1n << 12n],
    ['ManageMessages', 1n << 13n],
    ['EmbedLinks', 1n << 14n],
    ['AttachFiles', 1n << 15n],
    ['ReadMessageHistory', 1n << 16n],
    ['MentionEveryone', 1n << 17n],
    ['UseExternalEmojis', 1n << 18n],
    ['ViewGuildInsights', 1n << 19n],
    ['Connect', 1n << 20n],
    ['Speak', 1n << 21n],
    ['MuteMembers', 1n << 22n],
    ['DeafenMembers', 1n << 23n],
    ['MoveMembers', 1n << 24n],
    ['UseVAD', 1n << 25n],
    ['ChangeNickname', 1n << 26n],
    ['ManageNicknames', 1n << 27n],
    ['ManageRoles', 1n << 28n],
    ['ManageWebhooks', 1n << 29n],
    ['ManageGuildExpressions', 1n << 30n],
    ['UseApplicationCommands', 1n << 31n],
    ['RequestToSpeak', 1n << 32n],
    ['ManageEvents', 1n << 33n],
    ['ManageThreads', 1n << 34n],
    ['CreatePublicThreads', 1n << 35n],
    ['CreatePrivateThreads', 1n << 36n],
    ['UseExternalStickers', 1n << 37n],
    ['SendMessagesInThreads', 1n << 38n],
    ['UseEmbeddedActivities', 1n << 39n],
    ['ModerateMembers', 1n << 40n],
    ['ViewCreatorMonetizationAnalytics', 1n << 41n],
    ['UseSoundboard', 1n << 42n],
    ['CreateGuildExpressions', 1n << 43n],
    ['CreateEvents', 1n << 44n],
    ['UseExternalSounds', 1n << 45n],
    ['SendVoiceMessages', 1n << 46n],
    ['SetVoiceChannelStatus', 1n << 48n],
    ['SendPolls', 1n << 49n],
    ['UseExternalApps', 1n << 50n],
    ['PinMessages', 1n << 51n],
    ['BypassSlowmode', 1n << 52n],
];

export function permissionNamesFromBitfield(value: string | bigint | number): string[] {
    try {
        const bitfield = BigInt(value);
        return DISCORD_PERMISSION_FLAGS
            .filter(([, flag]) => (bitfield & flag) === flag)
            .map(([name]) => name)
            .sort();
    } catch {
        return [];
    }
}

export function rolePermissionChannelKind(channelType: number): RolePermissionSnapshotChannelKind {
    if (channelType === 4) return 'category';
    if (channelType === 0) return 'text';
    if (channelType === 5) return 'announcement';
    if (channelType === 2) return 'voice';
    if (channelType === 13) return 'stage';
    if (channelType === 15) return 'forum';
    if (channelType === 16) return 'media';
    return 'unknown';
}

export function rolePermissionOverwriteType(overwriteType: number | string): RolePermissionSnapshotOverwriteType {
    if (overwriteType === 0 || overwriteType === '0' || overwriteType === 'role') return 'role';
    if (overwriteType === 1 || overwriteType === '1' || overwriteType === 'member') return 'member';
    return 'unknown';
}

/** Validates current snapshots and deliberately converts legacy v2 profile data to the ID-only v3 shape. */
export function parseRolePermissionSnapshot(value: unknown): RolePermissionSnapshotData {
    return normalizeRolePermissionSnapshot(value).snapshot;
}

export function normalizeRolePermissionSnapshot(value: unknown): NormalizedRolePermissionSnapshot {
    const decoded = typeof value === 'string' ? parseSnapshotJson(value) : value;
    const version = readSnapshotVersion(decoded);

    if (version === 3) {
        return {
            snapshot: snapshotV3Schema.parse(decoded) as RolePermissionSnapshotData,
            sourceVersion: 3,
        };
    }
    if (version === 2) {
        const legacy = snapshotV2Schema.parse(decoded);
        return {
            snapshot: {
                ...legacy,
                version: 3,
                roles: legacy.roles.map(role => ({
                    ...role,
                    members: role.members.map(member => ({ id: member.id })),
                })),
            } as RolePermissionSnapshotData,
            sourceVersion: 2,
        };
    }

    throw new Error(`Unsupported role permission snapshot version: ${String(version)}.`);
}

function parseSnapshotJson(value: string): unknown {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        throw new Error('Role permission snapshot JSON is invalid.');
    }
}

function readSnapshotVersion(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Role permission snapshot data is invalid.');
    }
    return Reflect.get(value, 'version');
}
