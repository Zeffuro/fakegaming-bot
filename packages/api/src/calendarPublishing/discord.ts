import { z } from 'zod';

const base = 'https://discord.com/api/v10';
const maxResponseBytes = 1_048_576;
const maxSnowflake = (1n << 64n) - 1n;
const snowflake = z.string().refine(value => /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= maxSnowflake);
const permissions = z.string().refine(value => /^(?:0|[1-9]\d{0,19})$/.test(value) && BigInt(value) <= maxSnowflake);
const roleSchema = z.object({ id: snowflake, permissions });
const guildSchema = z.object({ id: snowflake, name: z.string().min(1).max(100), owner_id: snowflake,
    roles: z.array(roleSchema).min(1).max(250) });
const memberSchema = z.object({ user: z.object({ id: snowflake }), roles: z.array(snowflake).max(250),
    pending: z.boolean().optional(), communication_disabled_until: z.string().max(100).nullable().optional() });
const overwriteSchema = z.object({ id: snowflake, type: z.union([z.literal(0), z.literal(1)]), allow: permissions, deny: permissions });
const channelSchema = z.object({ id: snowflake, guild_id: snowflake, name: z.string().min(1).max(100),
    type: z.number().int(), permission_overwrites: z.array(overwriteSchema).max(1000) });
const selfSchema = z.object({ id: snowflake, bot: z.literal(true) });
const bindingSchema = z.object({ id: snowflake, channel_id: snowflake.nullable().optional(), guild_id: snowflake.optional() });
const eventSchema = z.object({ id: snowflake, guild_id: snowflake, creator_id: snowflake, entity_type: z.literal(3),
    status: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) });
const finishedEventError = z.object({ code: z.literal(180000) });
const administrator = 1n << 3n;
const manageGuild = 1n << 5n;
const viewChannel = 1n << 10n;
const sendMessages = 1n << 11n;
const embedLinks = 1n << 14n;
const manageEvents = 1n << 33n;
const createEventsPermission = 1n << 44n;

export class CalendarPublishDiscordError extends Error {
    constructor(public readonly code: 'forbidden' | 'invalid_destination' | 'unavailable') {
        super(code);
        this.name = 'CalendarPublishDiscordError';
    }
}

export type PublicationWriteResult = { status: 'sent'; id: string } | { status: 'rejected' | 'uncertain' | 'missing' };
type Payload = Record<string, unknown>;
type RestResult = { status: number; data: unknown };
type Member = z.infer<typeof memberSchema>;
type Guild = z.infer<typeof guildSchema>;
type Channel = z.infer<typeof channelSchema>;

async function boundedJson(response: Response): Promise<unknown> {
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            length += chunk.value.byteLength;
            if (length > maxResponseBytes) {
                void reader.cancel().catch(() => undefined);
                return null;
            }
            chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    } catch {
        return null;
    } finally {
        reader.releaseLock();
    }
}

async function rest(path: string, method = 'GET', body?: string, inspectClientError = false): Promise<RestResult | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;
    try {
        const response = await fetch(`${base}${path}`, { method, redirect: 'error',
            headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
            body, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) {
            if (inspectClientError && response.status >= 400 && response.status < 500) {
                return { status: response.status, data: await boundedJson(response) };
            }
            void response.body?.cancel().catch(() => undefined);
            return { status: response.status, data: null };
        }
        return { status: response.status, data: await boundedJson(response) };
    } catch {
        return null;
    }
}

async function read<T>(path: string, schema: z.ZodType<T>, notFound: 'forbidden' | 'invalid_destination'): Promise<T> {
    const result = await rest(path);
    if (!result) throw new CalendarPublishDiscordError('unavailable');
    if (result.status === 403) throw new CalendarPublishDiscordError('forbidden');
    if (result.status === 404) throw new CalendarPublishDiscordError(notFound);
    if (result.status < 200 || result.status >= 300) throw new CalendarPublishDiscordError('unavailable');
    const parsed = schema.safeParse(result.data);
    if (!parsed.success) throw new CalendarPublishDiscordError('unavailable');
    return parsed.data;
}

function guildPermissions(guild: Guild, member: Member): bigint {
    const roles = new Map(guild.roles.map(role => [role.id, BigInt(role.permissions)]));
    if (roles.size !== guild.roles.length || !roles.has(guild.id) || new Set(member.roles).size !== member.roles.length
        || member.roles.some(id => !roles.has(id))) throw new CalendarPublishDiscordError('unavailable');
    let bits = roles.get(guild.id)!;
    for (const id of member.roles) bits |= roles.get(id)!;
    if (member.user.id === guild.owner_id || (bits & administrator) !== 0n) return maxSnowflake;
    if (member.pending) throw new CalendarPublishDiscordError('forbidden');
    if (member.communication_disabled_until) {
        const until = Date.parse(member.communication_disabled_until);
        if (!Number.isFinite(until)) throw new CalendarPublishDiscordError('unavailable');
        if (until > Date.now()) throw new CalendarPublishDiscordError('forbidden');
    }
    return bits;
}

function channelPermissions(baseBits: bigint, member: Member, channel: Channel): bigint {
    if ((baseBits & administrator) !== 0n) return baseBits;
    let bits = baseBits;
    const everyone = channel.permission_overwrites.find(overwrite => overwrite.type === 0 && overwrite.id === channel.guild_id);
    if (everyone) bits = (bits & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
    let allow = 0n;
    let deny = 0n;
    for (const overwrite of channel.permission_overwrites) {
        if (overwrite.type === 0 && overwrite.id !== channel.guild_id && member.roles.includes(overwrite.id)) {
            allow |= BigInt(overwrite.allow);
            deny |= BigInt(overwrite.deny);
        }
    }
    bits = (bits & ~deny) | allow;
    const personal = channel.permission_overwrites.find(overwrite => overwrite.type === 1 && overwrite.id === member.user.id);
    if (personal) bits = (bits & ~BigInt(personal.deny)) | BigInt(personal.allow);
    return bits;
}

export async function validatePublicationDestination(userId: string, guildId: string, channelId: string, createEvents: boolean): Promise<{ guildName: string; channelName: string }> {
    if (![userId, guildId, channelId].every(id => snowflake.safeParse(id).success) || typeof createEvents !== 'boolean') {
        throw new CalendarPublishDiscordError('invalid_destination');
    }
    const [guild, channel, user, self] = await Promise.all([
        read(`/guilds/${guildId}`, guildSchema, 'invalid_destination'),
        read(`/channels/${channelId}`, channelSchema, 'invalid_destination'),
        read(`/guilds/${guildId}/members/${userId}`, memberSchema, 'forbidden'),
        read('/users/@me', selfSchema, 'forbidden')
    ]);
    if (guild.id !== guildId || channel.id !== channelId || channel.guild_id !== guildId || ![0, 5].includes(channel.type)) {
        throw new CalendarPublishDiscordError('invalid_destination');
    }
    if (user.user.id !== userId) throw new CalendarPublishDiscordError('unavailable');
    const keys = channel.permission_overwrites.map(overwrite => `${overwrite.type}:${overwrite.id}`);
    if (new Set(keys).size !== keys.length) throw new CalendarPublishDiscordError('unavailable');
    const bot = await read(`/guilds/${guildId}/members/${self.id}`, memberSchema, 'forbidden');
    if (bot.user.id !== self.id) throw new CalendarPublishDiscordError('unavailable');
    const userBits = guildPermissions(guild, user);
    const botBits = guildPermissions(guild, bot);
    const requiredUserChannel = viewChannel | sendMessages;
    const requiredBotChannel = requiredUserChannel | embedLinks;
    if ((userBits & manageGuild) === 0n
        || (channelPermissions(userBits, user, channel) & requiredUserChannel) !== requiredUserChannel
        || (channelPermissions(botBits, bot, channel) & requiredBotChannel) !== requiredBotChannel
        || (createEvents && ((userBits & (createEventsPermission | manageEvents)) === 0n || (botBits & createEventsPermission) === 0n))) {
        throw new CalendarPublishDiscordError('forbidden');
    }
    return { guildName: guild.name, channelName: channel.name };
}

async function write(path: string, method: 'POST' | 'PATCH', payload: Payload, expected: { id?: string; channelId?: string; guildId?: string }): Promise<PublicationWriteResult> {
    if (!process.env.DISCORD_BOT_TOKEN) return { status: 'rejected' };
    let body: string;
    try {
        body = JSON.stringify(payload);
        if (Buffer.byteLength(body, 'utf8') > 65_536) return { status: 'rejected' };
    } catch {
        return { status: 'rejected' };
    }
    const eventEdit = method === 'PATCH' && expected.guildId !== undefined;
    const result = await rest(path, method, body, eventEdit);
    if (!result) return { status: 'uncertain' };
    if (method === 'PATCH' && result.status === 404) return { status: 'missing' };
    if (result.status >= 400 && result.status < 500) {
        return { status: eventEdit && finishedEventError.safeParse(result.data).success ? 'missing' : 'rejected' };
    }
    if (result.status < 200 || result.status >= 300) return { status: 'uncertain' };
    const parsed = bindingSchema.safeParse(result.data);
    if (!parsed.success || (expected.id && parsed.data.id !== expected.id)
        || (parsed.data.channel_id && parsed.data.channel_id !== expected.channelId)
        || (parsed.data.guild_id && parsed.data.guild_id !== expected.guildId)) return { status: 'uncertain' };
    return { status: 'sent', id: parsed.data.id };
}

export async function sendPublicationMessage(channelId: string, payload: Payload): Promise<PublicationWriteResult> {
    if (!snowflake.safeParse(channelId).success) return { status: 'rejected' };
    return write(`/channels/${channelId}/messages`, 'POST', { ...payload, allowed_mentions: { parse: [] } }, { channelId });
}

export async function editPublicationMessage(channelId: string, messageId: string, payload: Payload): Promise<PublicationWriteResult> {
    if (![channelId, messageId].every(id => snowflake.safeParse(id).success)) return { status: 'rejected' };
    return write(`/channels/${channelId}/messages/${messageId}`, 'PATCH', { ...payload, allowed_mentions: { parse: [] } }, { id: messageId, channelId });
}

export async function createPublicationEvent(guildId: string, payload: Payload): Promise<PublicationWriteResult> {
    if (!snowflake.safeParse(guildId).success) return { status: 'rejected' };
    return write(`/guilds/${guildId}/scheduled-events`, 'POST', { ...payload, entity_type: 3, channel_id: null, privacy_level: 2 }, { guildId });
}

export async function editPublicationEvent(guildId: string, eventId: string, payload: Payload): Promise<PublicationWriteResult> {
    if (![guildId, eventId].every(id => snowflake.safeParse(id).success)) return { status: 'rejected' };
    const path = `/guilds/${guildId}/scheduled-events/${eventId}`;
    if (payload.status === 4) {
        const [eventResult, selfResult] = await Promise.all([rest(path), rest('/users/@me')]);
        if (eventResult?.status === 404) return { status: 'missing' };
        if (!eventResult || !selfResult || eventResult.status < 200 || eventResult.status >= 300
            || selfResult.status < 200 || selfResult.status >= 300) return { status: 'rejected' };
        const event = eventSchema.safeParse(eventResult.data);
        const self = selfSchema.safeParse(selfResult.data);
        if (!event.success || !self.success || event.data.id !== eventId || event.data.guild_id !== guildId
            || event.data.creator_id !== self.data.id) return { status: 'rejected' };
        if (event.data.status === 4) return { status: 'sent', id: eventId };
        if (event.data.status === 3) return { status: 'missing' };
        payload = { ...payload, status: event.data.status === 2 ? 3 : 4 };
    }
    return write(path, 'PATCH', payload, { id: eventId, guildId });
}
