import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarPublishDiscordError, createPublicationEvent, editPublicationEvent, editPublicationMessage,
    sendPublicationMessage, validatePublicationDestination } from './discord.js';

const guildId = '123456789012345678';
const channelId = '223456789012345678';
const userId = '323456789012345678';
const botId = '423456789012345678';
const managerRoleId = '523456789012345678';
const botRoleId = '623456789012345678';
const extraRoleId = '723456789012345678';
const outputId = '823456789012345678';
const admin = 1n << 3n;
const manageGuild = 1n << 5n;
const view = 1n << 10n;
const send = 1n << 11n;
const embed = 1n << 14n;
const manageEvents = 1n << 33n;
const createEvents = 1n << 44n;
const fetchMock = vi.fn();
const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
type Overwrite = { id: string; type: number; allow: string; deny: string };

function fixture() {
    return {
        guild: { id: guildId, name: 'Guild', owner_id: extraRoleId, roles: [
            { id: guildId, permissions: (view | send).toString() },
            { id: managerRoleId, permissions: (manageGuild | createEvents).toString() },
            { id: botRoleId, permissions: (embed | createEvents).toString() },
            { id: extraRoleId, permissions: '0' }
        ] },
        channel: { id: channelId, guild_id: guildId, name: 'calendar', type: 0, permission_overwrites: [] as Overwrite[] },
        user: { user: { id: userId }, roles: [managerRoleId], pending: false, communication_disabled_until: null as string | null },
        bot: { user: { id: botId }, roles: [botRoleId] },
        self: { id: botId, bot: true }
    };
}

function serve(data = fixture(), overrides: Record<string, Response | Error> = {}) {
    const routes: Record<string, unknown> = {
        [`/guilds/${guildId}`]: data.guild,
        [`/channels/${channelId}`]: data.channel,
        [`/guilds/${guildId}/members/${userId}`]: data.user,
        [`/guilds/${guildId}/members/${botId}`]: data.bot,
        '/users/@me': data.self
    };
    fetchMock.mockImplementation(async (url: string) => {
        const path = url.replace('https://discord.com/api/v10', '');
        const overridden = overrides[path];
        if (overridden instanceof Error) throw overridden;
        if (overridden) return overridden.clone();
        if (!(path in routes)) throw new Error('Unexpected request');
        return jsonResponse(routes[path]);
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('DISCORD_BOT_TOKEN', 'test-token');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('calendar publication destination permissions', () => {
    it.each([0, 5])('validates a fresh guild text destination type %s without privileged member listing', async type => {
        const data = fixture();
        data.channel.type = type;
        serve(data);
        expect(await validatePublicationDestination(userId, guildId, channelId, true)).toEqual({ guildName: 'Guild', channelName: 'calendar' });
        expect(fetchMock).toHaveBeenCalledTimes(5);
        for (const [url, options] of fetchMock.mock.calls) {
            expect(url).toMatch(/^https:\/\/discord\.com\/api\/v10\//);
            expect(options).toMatchObject({ method: 'GET', redirect: 'error', signal: expect.any(AbortSignal) });
            expect(url).not.toMatch(/members\/?$/);
        }
    });

    it.each(['../bad', '0', '-1', '123?token=secret', '01', '18446744073709551616', '1'.repeat(100)])('rejects unsafe identifiers %s before fetching', async bad => {
        for (const ids of [[bad, guildId, channelId], [userId, bad, channelId], [userId, guildId, bad]]) {
            await expect(validatePublicationDestination(ids[0]!, ids[1]!, ids[2]!, false)).rejects.toMatchObject({ code: 'invalid_destination' });
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechecks revoked manager roles on the next call', async () => {
        const data = fixture();
        serve(data);
        await validatePublicationDestination(userId, guildId, channelId, false);
        data.user.roles = [];
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'forbidden' });
        expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it.each([userId, botId])('rejects a removed member %s', async removedId => {
        serve(fixture(), { [`/guilds/${guildId}/members/${removedId}`]: jsonResponse({}, 404) });
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it.each(['guild', 'type', 'channel-id'])('rejects a wrong destination %s', async kind => {
        const data = fixture();
        if (kind === 'guild') data.channel.guild_id = extraRoleId;
        if (kind === 'type') data.channel.type = 11;
        if (kind === 'channel-id') data.channel.id = extraRoleId;
        serve(data);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'invalid_destination' });
    });

    it.each([view, send])('honors everyone deny for channel permission %s', async bit => {
        const data = fixture();
        data.channel.permission_overwrites = [{ id: guildId, type: 0, allow: '0', deny: bit.toString() }];
        serve(data);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('aggregates role overwrites with allow precedence, then applies the member overwrite last', async () => {
        const data = fixture();
        data.user.roles.push(extraRoleId);
        data.channel.permission_overwrites = [
            { id: guildId, type: 0, allow: '0', deny: send.toString() },
            { id: managerRoleId, type: 0, allow: '0', deny: send.toString() },
            { id: extraRoleId, type: 0, allow: send.toString(), deny: '0' },
            { id: botRoleId, type: 0, allow: send.toString(), deny: '0' }
        ];
        serve(data);
        await validatePublicationDestination(userId, guildId, channelId, false);
        data.channel.permission_overwrites.push({ id: userId, type: 1, allow: '0', deny: send.toString() });
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'forbidden' });
        data.channel.permission_overwrites[4]!.allow = send.toString();
        await validatePublicationDestination(userId, guildId, channelId, false);
    });

    it('requires the bot to embed in the selected channel', async () => {
        const data = fixture();
        data.channel.permission_overwrites.push({ id: botId, type: 1, allow: '0', deny: embed.toString() });
        serve(data);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it.each(['owner', 'admin'])('applies actual Discord %s semantics after verified membership', async kind => {
        const data = fixture();
        if (kind === 'owner') data.guild.owner_id = userId;
        if (kind === 'admin') data.guild.roles[1]!.permissions = admin.toString();
        data.channel.permission_overwrites = [{ id: userId, type: 1, allow: '0', deny: (view | send).toString() }];
        serve(data);
        await validatePublicationDestination(userId, guildId, channelId, true);
    });

    it.each(['user', 'bot'])('only requires event creation authorization when requested (%s)', async kind => {
        const data = fixture();
        data.guild.roles[kind === 'user' ? 1 : 2]!.permissions = (kind === 'user' ? manageGuild : embed).toString();
        serve(data);
        await validatePublicationDestination(userId, guildId, channelId, false);
        await expect(validatePublicationDestination(userId, guildId, channelId, true)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('accepts user ManageEvents but requires bot CreateEvents for EXTERNAL creation', async () => {
        const data = fixture();
        data.guild.roles[1]!.permissions = (manageGuild | manageEvents).toString();
        serve(data);
        await validatePublicationDestination(userId, guildId, channelId, true);
        data.guild.roles[2]!.permissions = (embed | manageEvents).toString();
        await expect(validatePublicationDestination(userId, guildId, channelId, true)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it.each(['pending', 'timed-out'])('rejects membership restrictions %s', async kind => {
        const data = fixture();
        if (kind === 'pending') data.user.pending = true;
        if (kind === 'timed-out') data.user.communication_disabled_until = new Date(Date.now() + 60_000).toISOString();
        serve(data);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it.each(['bits', 'missing-role', 'duplicate-role', 'duplicate-overwrite', 'wrong-user', 'not-bot', 'bad-timeout'])('fails closed on malformed authorization data %s', async kind => {
        const data = fixture();
        if (kind === 'bits') data.guild.roles[1]!.permissions = 'not-permissions';
        if (kind === 'missing-role') data.user.roles.push(outputId);
        if (kind === 'duplicate-role') data.guild.roles.push(data.guild.roles[1]!);
        if (kind === 'duplicate-overwrite') data.channel.permission_overwrites = Array.from({ length: 2 }, () => ({ id: guildId, type: 0, allow: '0', deny: '0' }));
        if (kind === 'wrong-user') data.user.user.id = outputId;
        if (kind === 'not-bot') data.self.bot = false;
        if (kind === 'bad-timeout') data.user.communication_disabled_until = 'bad';
        serve(data);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'unavailable' });
    });

    it.each(['json', 'oversized', 'network', 'server', 'rate-limit', 'token'])('fails closed when fresh verification is unavailable (%s)', async kind => {
        const overrides: Record<string, Response | Error> = {};
        if (kind === 'json') overrides[`/guilds/${guildId}`] = new Response('{');
        if (kind === 'oversized') overrides[`/guilds/${guildId}`] = new Response(' '.repeat(1_048_577));
        if (kind === 'network') overrides[`/guilds/${guildId}`] = new Error('private error');
        if (kind === 'server') overrides[`/guilds/${guildId}`] = jsonResponse({}, 503);
        if (kind === 'rate-limit') overrides[`/guilds/${guildId}`] = jsonResponse({}, 429);
        if (kind === 'token') vi.stubEnv('DISCORD_BOT_TOKEN', '');
        serve(fixture(), overrides);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toBeInstanceOf(CalendarPublishDiscordError);
        await expect(validatePublicationDestination(userId, guildId, channelId, false)).rejects.toMatchObject({ code: 'unavailable' });
    });
});

describe('calendar publication Discord writes', () => {
    it.each(['send', 'edit'])('forces mention suppression on message %s', async kind => {
        fetchMock.mockResolvedValue(jsonResponse({ id: outputId, channel_id: channelId }));
        const payload = { content: '@everyone', allowed_mentions: { parse: ['everyone'], users: [userId] } };
        const result = kind === 'send' ? await sendPublicationMessage(channelId, payload) : await editPublicationMessage(channelId, outputId, payload);
        expect(result).toEqual({ status: 'sent', id: outputId });
        const [url, options] = fetchMock.mock.calls[0]!;
        expect(url).toBe(`https://discord.com/api/v10/channels/${channelId}/messages${kind === 'edit' ? `/${outputId}` : ''}`);
        expect(JSON.parse(options.body)).toEqual({ content: '@everyone', allowed_mentions: { parse: [] } });
        expect(options).toMatchObject({ method: kind === 'send' ? 'POST' : 'PATCH', redirect: 'error', signal: expect.any(AbortSignal) });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('creates only guild EXTERNAL scheduled events and preserves ordinary edits', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ id: outputId, guild_id: guildId, channel_id: null }));
        const payload = { name: 'Event', entity_type: 2, channel_id: channelId, privacy_level: 1 };
        expect(await createPublicationEvent(guildId, payload)).toEqual({ status: 'sent', id: outputId });
        expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ name: 'Event', entity_type: 3, channel_id: null, privacy_level: 2 });
        expect(await editPublicationEvent(guildId, outputId, { name: 'Updated event' })).toEqual({ status: 'sent', id: outputId });
        expect(fetchMock.mock.calls[1]![0]).toBe(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${outputId}`);
        expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ name: 'Updated event' });
    });

    it.each([400, 401, 403, 404, 429])('returns rejected for explicit client rejection HTTP%s without retrying', async status => {
        fetchMock.mockImplementation(async () => jsonResponse({ private: 'error body' }, status));
        expect(await sendPublicationMessage(channelId, {})).toEqual({ status: 'rejected' });
        expect(await createPublicationEvent(guildId, {})).toEqual({ status: 'rejected' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([403, 404])('separates edit rejection from missing HTTP%s', async status => {
        fetchMock.mockImplementation(async () => jsonResponse({}, status));
        const expected = { status: status === 404 ? 'missing' : 'rejected' };
        expect(await editPublicationMessage(channelId, outputId, {})).toEqual(expected);
        expect(await editPublicationEvent(guildId, outputId, {})).toEqual(expected);
    });

    it.each(['network', 'abort', 'server', 'redirect', 'json', 'missing-id', 'unsafe-id', 'wrong-id', 'wrong-channel', 'oversized'])('never transparently retries uncertain message/event writes (%s)', async kind => {
        fetchMock.mockImplementation(async () => {
            if (kind === 'network') throw new Error('network');
            if (kind === 'abort') throw new DOMException('timeout', 'TimeoutError');
            if (kind === 'server') return jsonResponse({}, 503);
            if (kind === 'redirect') return new Response(null, { status: 302 });
            if (kind === 'json') return new Response('{');
            if (kind === 'missing-id') return jsonResponse({});
            if (kind === 'unsafe-id') return jsonResponse({ id: '../bad' });
            if (kind === 'wrong-id') return jsonResponse({ id: extraRoleId });
            if (kind === 'wrong-channel') return jsonResponse({ id: outputId, channel_id: extraRoleId });
            return new Response(' '.repeat(1_048_577));
        });
        expect(await editPublicationMessage(channelId, outputId, {})).toEqual({ status: 'uncertain' });
        expect(await editPublicationEvent(guildId, outputId, {})).toEqual({ status: 'uncertain' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('rejects local unsafe bindings, oversized payloads, cyclic payloads and missing credentials before mutations', async () => {
        expect(await sendPublicationMessage('../bad', {})).toEqual({ status: 'rejected' });
        expect(await editPublicationMessage(channelId, '../bad', {})).toEqual({ status: 'rejected' });
        expect(await createPublicationEvent('../bad', {})).toEqual({ status: 'rejected' });
        expect(await editPublicationEvent(guildId, '../bad', {})).toEqual({ status: 'rejected' });
        expect(await sendPublicationMessage(channelId, { content: 'x'.repeat(65_537) })).toEqual({ status: 'rejected' });
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(await sendPublicationMessage(channelId, cyclic)).toEqual({ status: 'rejected' });
        vi.stubEnv('DISCORD_BOT_TOKEN', '');
        expect(await sendPublicationMessage(channelId, {})).toEqual({ status: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('owned calendar event cancellation and terminal outcomes', () => {
    const ownedEvent = (status: number): Record<string, unknown> => ({ id: outputId, guild_id: guildId,
        creator_id: botId, entity_type: 3, status });
    const self = { id: botId, bot: true };

    it.each([1, 2, 3, 4])('uses the valid transition for current event status %s', async status => {
        fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
            if (options.method === 'PATCH') return jsonResponse({ id: outputId, guild_id: guildId, channel_id: null });
            return jsonResponse(url.endsWith('/users/@me') ? self : ownedEvent(status));
        });
        const payload = { status: 4, description: 'Preserved text' };
        expect(await editPublicationEvent(guildId, outputId, payload)).toEqual(status === 3 ? { status: 'missing' } : { status: 'sent', id: outputId });
        const mutations = fetchMock.mock.calls.filter(([_url, options]) => options.method !== 'GET');
        expect(mutations).toHaveLength(status < 3 ? 1 : 0);
        if (status < 3) expect(JSON.parse(mutations[0]![1].body)).toEqual({ status: status === 2 ? 3 : 4, description: 'Preserved text' });
        expect(payload).toEqual({ status: 4, description: 'Preserved text' });
        expect(fetchMock).toHaveBeenCalledTimes(status < 3 ? 3 : 2);
    });

    it.each(['wrong-id', 'wrong-guild', 'foreign-creator', 'absent-creator', 'null-creator', 'voice-event', 'unknown-status',
        'malformed-event', 'oversized-event', 'event-network', 'event-server', 'event-forbidden', 'self-network', 'self-server', 'self-forbidden',
        'malformed-self', 'not-bot'])('fails safely before mutation for cancellation verification %s', async kind => {
        const event = ownedEvent(1);
        if (kind === 'wrong-id') event.id = extraRoleId;
        if (kind === 'wrong-guild') event.guild_id = extraRoleId;
        if (kind === 'foreign-creator') event.creator_id = userId;
        if (kind === 'absent-creator') delete event.creator_id;
        if (kind === 'null-creator') event.creator_id = null;
        if (kind === 'voice-event') event.entity_type = 2;
        if (kind === 'unknown-status') event.status = 5;
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/users/@me')) {
                if (kind === 'self-network') throw new Error('Private network error');
                if (kind === 'self-server') return jsonResponse({}, 503);
                if (kind === 'self-forbidden') return jsonResponse({}, 403);
                if (kind === 'malformed-self') return new Response('{');
                return jsonResponse(kind === 'not-bot' ? { id: botId, bot: false } : self);
            }
            if (kind === 'event-network') throw new Error('Private network error');
            if (kind === 'event-server') return jsonResponse({}, 503);
            if (kind === 'event-forbidden') return jsonResponse({}, 403);
            if (kind === 'malformed-event') return new Response('{');
            if (kind === 'oversized-event') return new Response(' '.repeat(1_048_577));
            return jsonResponse(event);
        });
        expect(await editPublicationEvent(guildId, outputId, { status: 4 })).toEqual({ status: 'rejected' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        for (const [_url, options] of fetchMock.mock.calls) expect(options.method).toBe('GET');
    });

    it('retains a missing event outcome without issuing another mutation', async () => {
        fetchMock.mockImplementation(async (url: string) => url.endsWith('/users/@me') ? jsonResponse(self) : jsonResponse({}, 404));
        expect(await editPublicationEvent(guildId, outputId, { status: 4 })).toEqual({ status: 'missing' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        for (const [_url, options] of fetchMock.mock.calls) expect(options.method).toBe('GET');
    });

    it.each(['network', 'server', 'malformed'])('does not replay a cancellation mutation with %s outcome', async kind => {
        fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
            if (options.method === 'GET') return jsonResponse(url.endsWith('/users/@me') ? self : ownedEvent(2));
            if (kind === 'network') throw new Error('Private failure');
            if (kind === 'server') return jsonResponse({}, 503);
            return new Response('{');
        });
        expect(await editPublicationEvent(guildId, outputId, { status: 4 })).toEqual({ status: 'uncertain' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls.filter(([_url, options]) => options.method === 'PATCH')).toHaveLength(1);
    });

    it('retires only an explicitly rejected event edit with numeric error code 180000', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ code: 180000, message: 'Private error body' }, 400));
        expect(await editPublicationEvent(guildId, outputId, { name: 'Changed' })).toEqual({ status: 'missing' });
        expect(await editPublicationMessage(channelId, outputId, {})).toEqual({ status: 'rejected' });
        expect(await createPublicationEvent(guildId, {})).toEqual({ status: 'rejected' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it.each(['server', 'malformed', 'string-code', 'other-code', 'message-only', 'oversized', 'successful-error-body'])('does not retire ambiguous or unrelated error data %s', async kind => {
        fetchMock.mockImplementation(async () => {
            if (kind === 'server') return jsonResponse({ code: 180000 }, 503);
            if (kind === 'malformed') return new Response('{', { status: 400 });
            if (kind === 'string-code') return jsonResponse({ code: '180000' }, 400);
            if (kind === 'other-code') return jsonResponse({ code: 50035 }, 400);
            if (kind === 'message-only') return jsonResponse({ message: 'Cannot update a finished event' }, 400);
            if (kind === 'successful-error-body') return jsonResponse({ code: 180000 });
            return new Response(JSON.stringify({ code: 180000, padding: 'x'.repeat(1_048_577) }), { status: 400 });
        });
        expect(await editPublicationEvent(guildId, outputId, {})).toEqual({ status: kind === 'server' || kind === 'successful-error-body' ? 'uncertain' : 'rejected' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
