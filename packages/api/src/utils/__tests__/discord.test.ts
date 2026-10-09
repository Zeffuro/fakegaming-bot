import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as discord from '../discord.js';

const ORIGINAL_ENV = { ...process.env };

type MockResponseInit = { ok?: boolean; status?: number; headers?: HeadersInit; jsonBody?: any; textBody?: string };
function mockFetchOnce(response: MockResponseInit) {
    const res: any = {
        ok: response.ok ?? true,
        status: response.status ?? 200,
        headers: new Headers(response.headers ?? {}),
        json: async () => (response.jsonBody ?? { id: '123' }),
        text: async () => (response.textBody ?? ''),
    };
    return vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce(res);
}

describe('utils/discord', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });
    afterEach(() => {
        vi.restoreAllMocks();
        process.env = { ...ORIGINAL_ENV };
    });

    it('sendChannelMessage returns null when token missing', async () => {
        delete process.env.DISCORD_BOT_TOKEN;
        const out = await discord.sendChannelMessage('chan', 'hi');
        expect(out).toBeNull();
    });

    it('sendChannelMessage handles 429 rate limit and non-ok', async () => {
        process.env.DISCORD_BOT_TOKEN = 't';
        mockFetchOnce({ ok: false, status: 429, headers: { 'retry-after': '2' }, textBody: 'nope' });
        const out = await discord.sendChannelMessage('chan', 'hi');
        expect(out).toBeNull();
    });

    it('sendChannelMessagePayload returns parsed json on success', async () => {
        process.env.DISCORD_BOT_TOKEN = 't';
        mockFetchOnce({ ok: true, status: 200, jsonBody: { id: 'abc' } });
        const out = await discord.sendChannelMessagePayload('chan', { content: 'x' });
        expect(out).toEqual({ id: 'abc' });
    });

    it('sendDirectMessage creates DM then posts; returns null if DM creation fails', async () => {
        process.env.DISCORD_BOT_TOKEN = 't';
        // First call (create DM) not ok
        mockFetchOnce({ ok: false, status: 400, textBody: 'bad' });
        const out = await discord.sendDirectMessage('user', 'hello');
        expect(out).toBeNull();
    });

    it('sendDirectMessage posts to created channel', async () => {
        process.env.DISCORD_BOT_TOKEN = 't';
        // First call ok: create DM
        mockFetchOnce({ ok: true, jsonBody: { id: 'dm123' } });
        // Second call ok: send message
        mockFetchOnce({ ok: true, jsonBody: { id: 'msg1' } });
        const out = await discord.sendDirectMessage('user', 'hello');
        expect(out).toEqual({ id: 'msg1' });
    });

    it.each([403, 429, 500])('classifies a reminder POST response %s without losing the outcome', async status => {
        process.env.DISCORD_BOT_TOKEN = 'test';
        mockFetchOnce({ jsonBody: { id: 'dm' } });
        mockFetchOnce({ ok: false, status, textBody: 'failed' });
        const result = await discord.sendDirectMessagePayloadResult('user', { content: 'task' });
        expect(result).toEqual({ status: status >= 500 ? 'unknown' : 'rejected' });
        const calls = vi.mocked(globalThis.fetch).mock.calls;
        expect(calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
        expect(calls[1]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('distinguishes network uncertainty after DM creation from failure before the message POST', async () => {
        process.env.DISCORD_BOT_TOKEN = 'test';
        mockFetchOnce({ jsonBody: { id: 'dm' } });
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connection lost'));
        expect(await discord.sendDirectMessagePayloadResult('user', { content: 'task' })).toEqual({ status: 'unknown' });
        vi.restoreAllMocks();
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('DM channel creation lost'));
        expect(await discord.sendDirectMessagePayloadResult('user', { content: 'task' })).toEqual({ status: 'rejected' });
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('bounds DM creation so an expired send claim cannot POST a reminder much later', async () => {
        process.env.DISCORD_BOT_TOKEN = 'test';
        vi.useFakeTimers();
        const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), milliseconds);
            return controller.signal;
        });
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }));
        try {
            const sending = discord.sendDirectMessagePayloadResult('user', { content: 'task' });
            await vi.advanceTimersByTimeAsync(15_000);
            expect(await sending).toEqual({ status: 'rejected' });
            expect(timeout).toHaveBeenCalledWith(15_000);
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
