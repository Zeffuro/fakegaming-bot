import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const P = { ViewChannel: 1n << 10n, ReadMessageHistory: 1n << 16n, SendMessages: 1n << 11n,
    CreatePublicThreads: 1n << 35n, CreatePrivateThreads: 1n << 36n, SendMessagesInThreads: 1n << 38n,
    EmbedLinks: 1n << 14n, AttachFiles: 1n << 15n };
import { getSubmissionOptions, validateSubmissionConfig } from '../submissionConfig.js';

const writes = P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads;
const botPermissions = P.ViewChannel | P.SendMessages | P.EmbedLinks | P.AttachFiles | P.ReadMessageHistory;
const input = { name: 'Screenshots', destinationChannelId: '2', reviewChannelId: '3',
    reviewerRoleIds: ['4'], submitterRoleIds: [], enabled: true };
let roles: Array<{ id: string; name: string; permissions: string; managed?: boolean }>;
let channels: Array<{ id: string; name: string; type: number; guild_id: string; permission_overwrites: Array<{
    id: string; type: number; allow: string; deny: string; allow_new?: string; deny_new?: string;
}> }>;
const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubEnv('DISCORD_BOT_TOKEN', 'fixture-token');
    vi.stubGlobal('fetch', fetchMock);
    roles = [ { id: '1', name: 'Everyone', permissions: String(P.ViewChannel | P.ReadMessageHistory | writes) },
        { id: '4', name: 'Reviewer', permissions: '0' }, { id: '5', name: 'Bot', permissions: String(botPermissions), managed: true } ];
    channels = [
        { id: '3', name: 'Review', guild_id: '1', type: 0, permission_overwrites: [
            { id: '1', type: 0, deny: String(P.ViewChannel), allow: '0' },
            { id: '4', type: 0, deny: '0', allow: String(P.ViewChannel) },
            { id: '5', type: 0, deny: '0', allow: String(botPermissions) },
        ] },
        { id: '2', name: 'Showcase', guild_id: '1', type: 0, permission_overwrites: [
            { id: '1', type: 0, deny: String(writes), allow: '0' },
            { id: '5', type: 0, deny: '0', allow: String(botPermissions) },
        ] },
    ];
    fetchMock.mockReset().mockImplementation(async (url: string) => {
        const payload = url.endsWith('/roles') ? roles : url.endsWith('/channels') ? channels
            : url.endsWith('/users/@me') ? { id: '10' } : { roles: ['5'] };
        return new Response(JSON.stringify(payload), { status: 200 });
    });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('live submission configuration validation', () => {
    it('verifies actual Discord roles, channel privacy, thread writes and bot media access', async () => {
        await expect(validateSubmissionConfig('1', input)).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(4);
        channels[0]!.permission_overwrites.push({ id: '99', type: 1, deny: '0', allow: String(P.ViewChannel) });
        await expect(validateSubmissionConfig('1', input)).rejects.toMatchObject({ code: 'review-access' });
    });
    it('rejects unknown submitter roles and foreign channels', async () => {
        await expect(validateSubmissionConfig('1', { ...input, submitterRoleIds: ['99'] })).rejects.toMatchObject({ code: 'invalid-role' });
        channels[0]!.guild_id = '9';
        await expect(getSubmissionOptions('1')).rejects.toMatchObject({ code: 'provider-unavailable' });
    });
    it('prefers full-precision overwrite values when Discord includes legacy and new fields', async () => {
        channels[0]!.permission_overwrites[0]!.deny = '0';
        channels[0]!.permission_overwrites[0]!.deny_new = String(P.ViewChannel);
        await expect(validateSubmissionConfig('1', input)).resolves.toBeUndefined();
        channels[0]!.permission_overwrites.push({ id: '99', type: 1, allow: '0', deny: '0', allow_new: String(P.ViewChannel) });
        await expect(validateSubmissionConfig('1', input)).rejects.toMatchObject({ code: 'review-access' });
    });
    it('fails closed for provider errors, absent tokens and malformed permission responses', async () => {
        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
        await expect(validateSubmissionConfig('1', input)).rejects.toMatchObject({ code: 'provider-unavailable' });
        roles[0]!.permissions = 'invalid';
        await expect(validateSubmissionConfig('1', input)).rejects.toMatchObject({ code: 'invalid-channel' });
        vi.stubEnv('DISCORD_BOT_TOKEN', '');
        await expect(getSubmissionOptions('1')).rejects.toMatchObject({ code: 'provider-unavailable' });
    });
});
