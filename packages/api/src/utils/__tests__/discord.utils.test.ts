import '../../vitest.setup.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendChannelMessage, sendDirectMessage, sendChannelMessagePayload } from '../discord.js';

const originalToken = process.env.DISCORD_BOT_TOKEN;

function mockFetchOnce(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
    (global as any).fetch = vi.fn(impl as any);
}

describe('utils/discord', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        process.env.DISCORD_BOT_TOKEN = originalToken;
        // default: a working token
        process.env.DISCORD_BOT_TOKEN = 'test-token';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.DISCORD_BOT_TOKEN = originalToken;
    });

    it('sendChannelMessage returns null when token missing', async () => {
        process.env.DISCORD_BOT_TOKEN = '';
        const res = await sendChannelMessage('chan', 'hi');
        expect(res).toBeNull();
    });

    it('sendChannelMessage handles 429 and non-ok response', async () => {
        mockFetchOnce(async () => new Response('rate limited', { status: 429, headers: { 'retry-after': '1' } }));
        const res = await sendChannelMessage('chan', 'hi');
        expect(res).toBeNull();
        expect((global as any).fetch).toHaveBeenCalledTimes(1);
    });

    it('sendChannelMessage returns JSON on success', async () => {
        const payload = { id: '123' };
        mockFetchOnce(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }));
        const res = await sendChannelMessage('chan', 'hi');
        expect(res).toEqual(payload);
    });

    it('sendDirectMessage returns null when DM channel creation fails', async () => {
        mockFetchOnce(async () => new Response('bad', { status: 400 }));
        const res = await sendDirectMessage('user1', 'hi');
        expect(res).toBeNull();
    });

    it('sendDirectMessage returns null when DM channel response lacks id', async () => {
        const calls: Response[] = [
            new Response(JSON.stringify({}), { status: 200 }),
        ];
        mockFetchOnce(async () => calls.shift()!);
        const res = await sendDirectMessage('user3', 'noop');
        expect(res).toBeNull();
    });

    it('sendDirectMessage creates DM then posts message', async () => {
        const calls: Response[] = [
            new Response(JSON.stringify({ id: 'dm-chan' }), { status: 200 }),
            new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 })
        ];
        mockFetchOnce(async () => calls.shift()!);
        const res = await sendDirectMessage('user2', 'hello');
        expect(res).toEqual({ id: 'msg-1' });
        expect((global as any).fetch).toHaveBeenCalledTimes(2);
    });

    it('sendChannelMessagePayload mirrors message behavior for missing token', async () => {
        process.env.DISCORD_BOT_TOKEN = '';
        const res = await sendChannelMessagePayload('chan', { content: 'hi' });
        expect(res).toBeNull();
    });

    it('sendChannelMessagePayload handles 429 and returns null', async () => {
        mockFetchOnce(async () => new Response('rate limited', { status: 429 }));
        const res = await sendChannelMessagePayload('chan', { content: 'rate' });
        expect(res).toBeNull();
    });

    it('sendChannelMessagePayload returns JSON on success', async () => {
        const payload = { id: 'abc' };
        mockFetchOnce(async () => new Response(JSON.stringify(payload), { status: 200 }));
        const res = await sendChannelMessagePayload('chan', { embeds: [] });
        expect(res).toEqual(payload);
    });

    it('sendChannelMessage returns null on fetch exception', async () => {
        (global as any).fetch = vi.fn(async () => { throw new Error('network'); });
        const res = await sendChannelMessage('chan', 'hi');
        expect(res).toBeNull();
    });

    it('sendChannelMessagePayload returns null on fetch exception', async () => {
        (global as any).fetch = vi.fn(async () => { throw new Error('network'); });
        const res = await sendChannelMessagePayload('chan', { content: 'x' });
        expect(res).toBeNull();
    });

    it('sendDirectMessage returns null on fetch exception during DM creation', async () => {
        (global as any).fetch = vi.fn(async () => { throw new Error('network'); });
        const res = await sendDirectMessage('user4', 'hi');
        expect(res).toBeNull();
    });

    it('sendChannelMessage returns null on non-429 non-ok response', async () => {
        mockFetchOnce(async () => new Response('bad request', { status: 400 }));
        const res = await sendChannelMessage('chan', 'oops');
        expect(res).toBeNull();
    });
});
