import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendChannelMessagePayloadResult } from '../discord.js';

const originalToken = process.env.DISCORD_BOT_TOKEN;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    process.env.DISCORD_BOT_TOKEN = 'test-only-token';
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
    else process.env.DISCORD_BOT_TOKEN = originalToken;
});

describe('Discord channel delivery outcomes', () => {
    it('returns the sent message and applies the default thirty-second timeout', async () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'message' }), { status: 200 }));
        await expect(sendChannelMessagePayloadResult('channel', { content: 'video' })).resolves.toEqual({ status: 'sent', message: { id: 'message' } });
        expect(timeout).toHaveBeenCalledWith(30_000);
        expect(fetchMock).toHaveBeenCalledWith('https://discord.com/api/v10/channels/channel/messages', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it.each([400, 403, 404, 429])('classifies HTTP %s as a definitive rejection', async status => {
        fetchMock.mockResolvedValue(new Response('rejected', { status }));
        await expect(sendChannelMessagePayloadResult('channel', {})).resolves.toEqual({ status: 'rejected' });
    });

    it.each([500, 502, 503])('keeps HTTP %s uncertain', async status => {
        fetchMock.mockResolvedValue(new Response('server error', { status }));
        await expect(sendChannelMessagePayloadResult('channel', {})).resolves.toEqual({ status: 'unknown' });
    });

    it('keeps a network failure uncertain', async () => {
        fetchMock.mockRejectedValue(new Error('socket closed'));
        await expect(sendChannelMessagePayloadResult('channel', {})).resolves.toEqual({ status: 'unknown' });
    });

    it('keeps invalid response JSON uncertain', async () => {
        fetchMock.mockResolvedValue(new Response('invalid json', { status: 200 }));
        await expect(sendChannelMessagePayloadResult('channel', {})).resolves.toEqual({ status: 'unknown' });
    });

    it('bounds a stalled request and keeps its outcome uncertain', async () => {
        fetchMock.mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
        }));
        await expect(sendChannelMessagePayloadResult('channel', {}, { timeoutMs: 10 })).resolves.toEqual({ status: 'unknown' });
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('rejects a missing token without making a request', async () => {
        delete process.env.DISCORD_BOT_TOKEN;
        await expect(sendChannelMessagePayloadResult('channel', {})).resolves.toEqual({ status: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
