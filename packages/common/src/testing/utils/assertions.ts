import { expect } from 'vitest';

export type HasStatusLike = { status: number } | { statusCode: number };

function getStatus(res: HasStatusLike): number {
    // Prefer explicit status; fall back to statusCode for frameworks like Next.js
    return (res as any).status ?? (res as any).statusCode;
}

export function expectOk(res: HasStatusLike) { expect(getStatus(res)).toBe(200); }
export function expectCreated(res: HasStatusLike) { expect(getStatus(res)).toBe(201); }
export function expectBadRequest(res: HasStatusLike) { expect(getStatus(res)).toBe(400); }
export function expectUnauthorized(res: HasStatusLike) { expect(getStatus(res)).toBe(401); }
export function expectForbidden(res: HasStatusLike) { expect(getStatus(res)).toBe(403); }
export function expectNotFound(res: HasStatusLike) { expect(getStatus(res)).toBe(404); }
export function expectConflict(res: HasStatusLike) { expect(getStatus(res)).toBe(409); }
export function expectTooManyRequests(res: HasStatusLike) { expect(getStatus(res)).toBe(429); }
export function expectInternalServerError(res: HasStatusLike) { expect(getStatus(res)).toBe(500); }
export function expectServiceUnavailable(res: HasStatusLike) { expect(getStatus(res)).toBe(503); }

// Helpers to assert the standardized error envelope { error: { code, message, details? } }
interface HasBodyLike {
    status: number;
    body?: unknown;
    text?: string;
}

interface ErrorEnvelope { error?: { code?: string; message?: string; details?: unknown } }

function parseBody(maybe: unknown): ErrorEnvelope | undefined {
    if (maybe && typeof maybe === 'object') return maybe as ErrorEnvelope;
    return undefined;
}

function tryParseJson(text: string | undefined): ErrorEnvelope | undefined {
    if (!text) return undefined;
    try {
        const parsed = JSON.parse(text) as unknown;
        return parseBody(parsed);
    } catch {
        return undefined;
    }
}

function getErrorEnvelope(res: HasBodyLike): { code?: string; message?: string; details?: unknown } | undefined {
    const fromBody = parseBody(res.body)?.error;
    if (fromBody) return fromBody;
    return tryParseJson(res.text)?.error;
}

export function expectErrorCode(res: HasBodyLike, code: string): void {
    const err = getErrorEnvelope(res);
    expect(err, 'response should include an error envelope').toBeDefined();
    expect(err?.code).toBe(code);
}

export function expectErrorMessageContains(res: HasBodyLike, substring: string): void {
    const err = getErrorEnvelope(res);
    expect(err, 'response should include an error envelope').toBeDefined();
    const msg = err?.message ?? '';
    expect(String(msg)).toContain(substring);
}

// --- Discord interaction reply assertions ---

/**
 * Extracts the first argument passed to reply() for an interaction mock.
 */
function getFirstReplyArg(interaction: unknown): unknown {
    const calls = (interaction as any)?.reply?.mock?.calls as any[][] | undefined;
    return calls && calls.length > 0 ? calls[0][0] : undefined;
}

/**
 * Extracts the first argument passed to editReply() for an interaction mock.
 */
function getFirstEditReplyArg(interaction: unknown): unknown {
    const calls = (interaction as any)?.editReply?.mock?.calls as any[][] | undefined;
    return calls && calls.length > 0 ? calls[0][0] : undefined;
}

/**
 * Pulls the first embed-like object off a Discord message payload.
 * Supports both EmbedBuilder (via .data) and plain object shapes.
 */
function extractFirstEmbed(payload: unknown): any | undefined {
    if (!payload) return undefined;

    // If payload is already an embed-like object (EmbedBuilder or plain embed)
    if (typeof payload === 'object') {
        const maybeEmbed = payload as any;
        // EmbedBuilder or APIEmbed-like if has data/title/description/fields
        if (maybeEmbed?.data || typeof maybeEmbed?.title === 'string' || typeof maybeEmbed?.description === 'string' || Array.isArray(maybeEmbed?.fields)) {
            return maybeEmbed;
        }
        // Typical Discord reply shape: { embeds: [...] }
        const embeds = (maybeEmbed as any).embeds as any[] | undefined;
        if (Array.isArray(embeds) && embeds.length > 0) return embeds[0];
    }

    // If payload is an array, return first element when embed-like
    if (Array.isArray(payload) && payload.length > 0) {
        const first = payload[0] as any;
        if (!first) return undefined;
        if (first?.data || typeof first?.title === 'string' || typeof first?.description === 'string' || Array.isArray(first?.fields)) {
            return first;
        }
    }

    return undefined;
}

/**
 * Gets the title/description/fields from an embed that may be an EmbedBuilder (.data) or plain object.
 */
function getEmbedData(embed: any): { title?: unknown; description?: unknown; fields?: unknown } {
    if (!embed || typeof embed !== 'object') return {};
    const data = (embed as any).data && typeof (embed as any).data === 'object' ? (embed as any).data : embed;
    return {
        title: (data as any).title,
        description: (data as any).description,
        fields: (data as any).fields,
    };
}

/**
 * Assert that an interaction replied ephemerally. Optionally match content text partially or exactly.
 */
export function expectEphemeralReply(
    interaction: unknown,
    opts: { contains?: string; equals?: string } = {}
): void {
    const arg = getFirstReplyArg(interaction);
    expect(arg).toBeDefined();
    const payload = arg as any;

    // Ephemeral can be specified either via flags === 64 or ephemeral: true
    const isEphemeral = (typeof payload === 'object' && payload !== null) && (
        (payload as any).ephemeral === true || (payload as any).flags === 64
    );
    expect(isEphemeral).toBe(true);

    if (typeof opts.equals === 'string') {
        const content = typeof payload === 'string' ? payload : (payload as any)?.content;
        expect(content).toBe(opts.equals);
    }
    if (typeof opts.contains === 'string') {
        const content = typeof payload === 'string' ? payload : (payload as any)?.content;
        expect(typeof content).toBe('string');
        expect((content as string)).toContain(opts.contains);
    }
}

/**
 * Assert that the reply text equals the expected string. Accepts string or { content } payloads.
 */
export function expectReplyText(
    interaction: unknown,
    expected: string
): void {
    const arg = getFirstReplyArg(interaction);
    expect(arg).toBeDefined();
    const payload = arg as any;
    const content = typeof payload === 'string' ? payload : (payload as any)?.content;
    expect(content).toBe(expected);
}

/**
 * Assert that the reply text contains the expected substring. Accepts string or { content } payloads.
 */
export function expectReplyTextContains(
    interaction: unknown,
    substring: string
): void {
    const arg = getFirstReplyArg(interaction);
    expect(arg).toBeDefined();
    const payload = arg as any;
    const content = typeof payload === 'string' ? payload : (payload as any)?.content;
    expect(typeof content).toBe('string');
    expect((content as string)).toContain(substring);
}

/**
 * Assert that reply was never called.
 */
export function expectNoReply(
    interaction: unknown
): void {
    const calls = (interaction as any)?.reply?.mock?.calls as any[][] | undefined;
    expect(calls?.length ?? 0).toBe(0);
}

/**
 * Assert that editReply contains specific text (string payload or object with content/embeds description strings).
 */
export function expectEditReplyContainsText(
    interaction: unknown,
    substring: string
): void {
    const arg = getFirstEditReplyArg(interaction);
    expect(arg).toBeDefined();
    const payload = arg as any;
    if (typeof payload === 'string') {
        expect(payload).toContain(substring);
        return;
    }
    const content = (payload as any)?.content as unknown;
    if (typeof content === 'string') {
        expect(content).toContain(substring);
        return;
    }
    const embed = extractFirstEmbed(payload);
    const data = getEmbedData(embed);
    const desc = data.description;
    if (typeof desc === 'string') {
        expect(desc).toContain(substring);
    } else {
        expect(desc, 'expected description text to contain substring').toBeDefined();
    }
}

/**
 * Assert that editReply payload contains at least one attachment with a filename matching the expected criteria.
 */
export function expectEditReplyWithAttachment(
    interaction: unknown,
    opts: { filenameIncludes?: string; filenameEquals?: string; contentContains?: string } = {}
): void {
    const arg = getFirstEditReplyArg(interaction);
    expect(arg).toBeDefined();
    const payload = arg as any;
    expect(typeof payload).toBe('object');

    const files = (((payload as any)?.files ?? []) as Array<any>);
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);

    const name = (files[0] as any)?.name ?? (files[0] as any)?.attachment?.name ?? '';

    if (typeof opts.filenameEquals === 'string') {
        expect(name).toBe(opts.filenameEquals);
    }
    if (typeof opts.filenameIncludes === 'string') {
        expect(String(name)).toContain(opts.filenameIncludes);
    }

    if (typeof opts.contentContains === 'string') {
        const content = typeof (payload as any).content === 'string' ? (payload as any).content : '';
        expect(content).toContain(opts.contentContains);
    }
}

// --- New: Embed presence/title/fields assertions ---

interface EmbedExpectOptions {
    titleEquals?: string;
    titleContains?: string;
    descriptionEquals?: string;
    descriptionContains?: string;
    field?: {
        nameEquals?: string;
        nameContains?: string;
        valueEquals?: string;
        valueContains?: string;
    };
}

/**
 * Find the first embed-like object in a list of mock calls.
 * Scans for a non-empty embeds array in the payload.
 */
function findEmbedInCalls(calls: any[][] | undefined): any | undefined {
    if (!calls || calls.length === 0) return undefined;
    for (const call of calls) {
        const arg = call?.[0];
        const embed = extractFirstEmbed(arg);
        if (embed) return embed;
    }
    return undefined;
}

/**
 * Asserts that the first reply payload includes an embed, with optional title/description/field checks.
 */
export function expectReplyHasEmbed(
    interaction: unknown,
    opts: EmbedExpectOptions = {}
): void {
    const replyCalls = (interaction as any)?.reply?.mock?.calls as any[][] | undefined;
    const embed = findEmbedInCalls(replyCalls);
    expect(embed).toBeDefined();
    assertEmbedDetails(embed, opts);
}

/**
 * Asserts that the first editReply payload includes an embed, with optional title/description/field checks.
 */
export function expectEditReplyHasEmbed(
    interaction: unknown,
    opts: EmbedExpectOptions = {}
): void {
    const editCalls = (interaction as any)?.editReply?.mock?.calls as any[][] | undefined;
    const embed = findEmbedInCalls(editCalls);
    expect(embed).toBeDefined();
    assertEmbedDetails(embed, opts);
}

/**
 * Asserts that the first send(target.send) payload includes an embed, with optional title/description/field checks.
 * Useful for channel.send() / user.send() assertions in service tests.
 */
export function expectSendHasEmbed(
    targetWithSend: unknown,
    opts: EmbedExpectOptions = {}
): void {
    const sendCalls = (targetWithSend as any)?.send?.mock?.calls as any[][] | undefined;
    const embed = findEmbedInCalls(sendCalls);
    expect(embed).toBeDefined();
    assertEmbedDetails(embed, opts);
}

function assertEmbedDetails(embed: any, opts: EmbedExpectOptions): void {
    const { title, description, fields } = getEmbedData(embed);

    if (typeof opts.titleEquals === 'string') {
        expect(String(title ?? '')).toBe(opts.titleEquals);
    }
    if (typeof opts.titleContains === 'string') {
        expect(String(title ?? '')).toContain(opts.titleContains);
    }

    if (typeof opts.descriptionEquals === 'string') {
        expect(String(description ?? '')).toBe(opts.descriptionEquals);
    }
    if (typeof opts.descriptionContains === 'string') {
        expect(String(description ?? '')).toContain(opts.descriptionContains);
    }

    if (opts.field) {
        const arr = Array.isArray(fields) ? fields as Array<any> : [];
        expect(arr.length).toBeGreaterThan(0);
        const match = arr.find((f) => {
            const name = String((f as any)?.name ?? '');
            const value = String((f as any)?.value ?? '');
            if (typeof opts.field?.nameEquals === 'string' && name !== opts.field.nameEquals) return false;
            if (typeof opts.field?.nameContains === 'string' && !name.includes(opts.field.nameContains)) return false;
            if (typeof opts.field?.valueEquals === 'string' && value !== opts.field.valueEquals) return false;
            if (typeof opts.field?.valueContains === 'string' && !value.includes(opts.field.valueContains)) return false;
            return true;
        });
        expect(match).toBeDefined();
    }
}

/**
 * Assert that at least one reply call payload has an embeds array with at least one element.
 */
export function expectReplyHasEmbedsArray(
    interaction: unknown,
    opts: { min?: number } = {}
): void {
    const min = typeof opts.min === 'number' ? opts.min : 1;
    const calls = (interaction as any)?.reply?.mock?.calls as any[][] | undefined;
    expect(calls && calls.length).toBeTruthy();
    const found = (calls ?? []).some((c) => Array.isArray((c?.[0] as any)?.embeds) && ((c?.[0] as any).embeds.length >= min));
    expect(found).toBe(true);
}
