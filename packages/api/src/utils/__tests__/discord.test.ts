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
});
