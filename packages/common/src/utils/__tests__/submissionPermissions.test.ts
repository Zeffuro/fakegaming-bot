import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits as P } from 'discord.js';
import { validateSubmissionChannelPermissions, type SubmissionPermissionInput } from '../submissionPermissions.js';

const writes = P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads;
const bot = P.ViewChannel | P.SendMessages | P.EmbedLinks | P.AttachFiles | P.ReadMessageHistory;
function fixture(): SubmissionPermissionInput {
    return { guildId: '1', botId: '10', botRoleIds: ['5'], reviewerRoleIds: ['4'], roles: [
        { id: '1', permissions: String(P.ViewChannel | P.ReadMessageHistory | writes) },
        { id: '4', permissions: '0' }, { id: '5', permissions: String(bot), managed: true },
        { id: '6', permissions: String(P.Administrator) }, { id: '7', permissions: '0' },
    ], reviewChannel: { id: '3', guildId: '1', type: 0, permissionOverwrites: [
        { id: '1', type: 0, deny: String(P.ViewChannel), allow: '0' },
        { id: '4', type: 0, deny: '0', allow: String(P.ViewChannel) },
        { id: '5', type: 0, deny: '0', allow: String(bot) },
    ] }, destinationChannel: { id: '2', guildId: '1', type: 0, permissionOverwrites: [
        { id: '1', type: 0, deny: String(writes), allow: '0' },
        { id: '4', type: 0, deny: '0', allow: String(P.SendMessages) },
        { id: '5', type: 0, deny: '0', allow: String(bot) },
    ] } };
}

describe('submission channel permission contract', () => {
    it('accepts private review and read-only publication with bot and reviewer access', () => {
        expect(validateSubmissionChannelPermissions(fixture())).toEqual({ valid: true, reason: null });
    });
    it('rejects ordinary-role visibility even when everyone is hidden', () => {
        const input = fixture();
        input.reviewChannel.permissionOverwrites.push({ id: '7', type: 0, deny: '0', allow: String(P.ViewChannel) });
        expect(validateSubmissionChannelPermissions(input).reason).toBe('review-access');
    });
    it('rejects member grants and thread write bypasses', () => {
        const member = fixture();
        member.reviewChannel.permissionOverwrites.push({ id: '99', type: 1, deny: '0', allow: String(P.ViewChannel) });
        expect(validateSubmissionChannelPermissions(member).reason).toBe('review-access');
        const threads = fixture();
        threads.destinationChannel.permissionOverwrites.push({ id: '7', type: 0, deny: '0', allow: String(P.SendMessagesInThreads) });
        expect(validateSubmissionChannelPermissions(threads).reason).toBe('destination-write');
    });
    it('requires bot media permissions, reviewer access, valid roles and same-guild channels', () => {
        const missing = fixture();
        missing.reviewChannel.permissionOverwrites = missing.reviewChannel.permissionOverwrites.filter(item => item.id !== '5');
        expect(validateSubmissionChannelPermissions(missing).reason).toBe('bot-permissions');
        const reviewer = fixture();
        reviewer.reviewChannel.permissionOverwrites = reviewer.reviewChannel.permissionOverwrites.filter(item => item.id !== '4');
        expect(validateSubmissionChannelPermissions(reviewer).reason).toBe('reviewer-access');
        const foreign = fixture(); foreign.reviewChannel.guildId = '9';
        expect(validateSubmissionChannelPermissions(foreign).reason).toBe('invalid-channel');
        const managed = fixture(); managed.reviewerRoleIds = ['5'];
        expect(validateSubmissionChannelPermissions(managed).reason).toBe('invalid-role');
    });
});
