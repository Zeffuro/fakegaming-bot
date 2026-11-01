import { DISCORD_PERMISSION_FLAGS } from '../discord/permissionSnapshot.js';

function permissionFlag(name: string): bigint {
    const value = DISCORD_PERMISSION_FLAGS.find(([key]) => key === name);
    if (!value) throw new Error(`Unknown Discord permission: ${name}`);
    return value[1];
}

const P = {
    Administrator: permissionFlag('Administrator'), ViewChannel: permissionFlag('ViewChannel'),
    SendMessages: permissionFlag('SendMessages'), EmbedLinks: permissionFlag('EmbedLinks'),
    AttachFiles: permissionFlag('AttachFiles'), ReadMessageHistory: permissionFlag('ReadMessageHistory'),
    CreatePublicThreads: permissionFlag('CreatePublicThreads'), CreatePrivateThreads: permissionFlag('CreatePrivateThreads'),
    SendMessagesInThreads: permissionFlag('SendMessagesInThreads'),
};

export interface SubmissionPermissionRole { id: string; permissions: string; managed?: boolean }
export interface SubmissionPermissionChannel {
    id: string;
    guildId: string;
    type: number;
    permissionOverwrites: Array<{ id: string; type: 0 | 1; allow: string; deny: string }>;
}
export type SubmissionPermissionReason = 'review-access' | 'destination-write' | 'bot-permissions'
    | 'reviewer-access' | 'invalid-channel' | 'invalid-role';
export interface SubmissionPermissionInput {
    guildId: string;
    botId: string;
    roles: SubmissionPermissionRole[];
    botRoleIds: string[];
    reviewerRoleIds: string[];
    reviewChannel: SubmissionPermissionChannel;
    destinationChannel: SubmissionPermissionChannel;
}

const writePermissions = P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads;
const botRequired = P.ViewChannel | P.SendMessages | P.EmbedLinks | P.AttachFiles | P.ReadMessageHistory;

export function validateSubmissionChannelPermissions(input: SubmissionPermissionInput): {
    valid: boolean; reason: SubmissionPermissionReason | null;
} {
    const fail = (reason: SubmissionPermissionReason) => ({ valid: false, reason });
    const { guildId, botId, roles, reviewerRoleIds, reviewChannel, destinationChannel } = input;
    if (reviewChannel.guildId !== guildId || destinationChannel.guildId !== guildId || reviewChannel.type !== 0
        || ![0, 5].includes(destinationChannel.type) || reviewChannel.id === destinationChannel.id) return fail('invalid-channel');
    if (!roles.some(role => role.id === guildId) || reviewerRoleIds.length === 0 || reviewerRoleIds.some(id =>
        id === guildId || !roles.some(role => role.id === id && !role.managed))) return fail('invalid-role');
    try {
        for (const role of roles) {
            if ((BigInt(role.permissions) & P.Administrator) !== 0n) continue;
            const reviewer = reviewerRoleIds.includes(role.id);
            const botRole = role.managed && input.botRoleIds.includes(role.id);
            const ids = role.id === guildId ? [] : [role.id];
            if (!reviewer && !botRole && (permissions(input, reviewChannel, ids) & P.ViewChannel) !== 0n) return fail('review-access');
            if (!reviewer && !botRole && (permissions(input, destinationChannel, ids) & writePermissions) !== 0n) return fail('destination-write');
            if (reviewer && (permissions(input, reviewChannel, ids) & (P.ViewChannel | P.ReadMessageHistory))
                !== (P.ViewChannel | P.ReadMessageHistory)) return fail('reviewer-access');
        }
        for (const channel of [reviewChannel, destinationChannel]) {
            for (const overwrite of channel.permissionOverwrites) {
                if (overwrite.type === 1 && overwrite.id !== botId
                    && (BigInt(overwrite.allow) & (channel === reviewChannel ? P.ViewChannel : writePermissions)) !== 0n) {
                    return fail(channel === reviewChannel ? 'review-access' : 'destination-write');
                }
            }
            if ((permissions(input, channel, input.botRoleIds, botId) & botRequired) !== botRequired) return fail('bot-permissions');
        }
        return { valid: true, reason: null };
    } catch { return fail('invalid-channel'); }
}

function permissions(input: SubmissionPermissionInput, channel: SubmissionPermissionChannel, roleIds: string[], memberId?: string): bigint {
    let value = input.roles.filter(role => role.id === input.guildId || roleIds.includes(role.id))
        .reduce((total, role) => total | BigInt(role.permissions), 0n);
    if ((value & P.Administrator) !== 0n) return ~0n;
    const everyone = channel.permissionOverwrites.find(item => item.type === 0 && item.id === input.guildId);
    if (everyone) value = (value & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
    const matching = channel.permissionOverwrites.filter(item => item.type === 0 && roleIds.includes(item.id));
    value = (value & ~matching.reduce((total, item) => total | BigInt(item.deny), 0n))
        | matching.reduce((total, item) => total | BigInt(item.allow), 0n);
    const member = channel.permissionOverwrites.find(item => item.type === 1 && item.id === memberId);
    if (member) value = (value & ~BigInt(member.deny)) | BigInt(member.allow);
    return value;
}
