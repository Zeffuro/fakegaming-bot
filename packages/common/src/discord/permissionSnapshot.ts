import type {
    RolePermissionSnapshotChannelKind,
    RolePermissionSnapshotOverwriteType,
} from '../models/role-permission-snapshot.js';

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

export function rolePermissionOverwriteType(overwriteType: number): RolePermissionSnapshotOverwriteType {
    if (overwriteType === 0) return 'role';
    if (overwriteType === 1) return 'member';
    return 'unknown';
}
