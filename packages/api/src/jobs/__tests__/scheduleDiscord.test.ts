import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendScheduleMessage, editScheduleMessage } from '../scheduleDiscord.js';

const fetchMock = vi.fn();
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubEnv('DISCORD_BOT_TOKEN', 'test-bot-token'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('private schedule Discord transport', () => {
    it('creates a DM and sends a bounded payload with a durable message binding', async () => {
        fetchMock.mockResolvedValueOnce(response(200, { id: '123' })).mockResolvedValueOnce(response(200, { id: '456' }));
        expect(await sendScheduleMessage('789', { content: 'Private', allowed_mentions: { parse: [] } })).toEqual({ status: 'sent', channelId: '123', messageId: '456' });
        expect(fetchMock.mock.calls[1]?.[0]).toBe('https://discord.com/api/v10/channels/123/messages');
        expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', signal: expect.any(AbortSignal) });
    });

    it.each([403, 429])('treats HTTP%s message rejection as safe to retry', async status => {
        fetchMock.mockResolvedValueOnce(response(200, { id: '123' })).mockResolvedValueOnce(response(status, {}));
        expect(await sendScheduleMessage('789', {})).toEqual({ status: 'rejected' });
    });

    it.each(['network', 'server', 'malformed', 'missing'])('treats a %s outcome after the message POST as uncertain', async kind => {
        fetchMock.mockResolvedValueOnce(response(200, { id: '123' }));
        if (kind === 'network') fetchMock.mockRejectedValueOnce(new Error('Network failed'));
        if (kind === 'server') fetchMock.mockResolvedValueOnce(response(503, {}));
        if (kind === 'malformed') fetchMock.mockResolvedValueOnce(new Response('{', { status: 200 }));
        if (kind === 'missing') fetchMock.mockResolvedValueOnce(response(200, {}));
        expect(await sendScheduleMessage('789', {})).toEqual({ status: 'uncertain' });
    });

    it.each(['network', 'rejected', 'malformed', 'unsafe', 'token'])('can retry DM creation failures (%s) because no message was sent', async kind => {
        if (kind === 'network') fetchMock.mockRejectedValueOnce(new Error('Failed'));
        if (kind === 'rejected') fetchMock.mockResolvedValueOnce(response(403, {}));
        if (kind === 'malformed') fetchMock.mockResolvedValueOnce(new Response('{', { status: 200 }));
        if (kind === 'unsafe') fetchMock.mockResolvedValueOnce(response(200, { id: '../bad' }));
        if (kind === 'token') vi.stubEnv('DISCORD_BOT_TOKEN', '');
        expect(await sendScheduleMessage('789', {})).toEqual({ status: 'rejected' });
        expect(fetchMock).toHaveBeenCalledTimes(kind === 'token' ? 0 : 1);
    });

    it.each([[200, 'edited'], [403, 'missing'], [404, 'missing'], [503, 'retry']])('handles edit HTTP%s without deleting history', async (status, outcome) => {
        fetchMock.mockResolvedValueOnce(response(Number(status), {}));
        expect(await editScheduleMessage('123', '456', {})).toBe(outcome);
        expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
    });

    it('rejects invalid bindings locally and preserves retry after network failure', async () => {
        expect(await editScheduleMessage('../bad', '456', {})).toBe('missing');
        expect(fetchMock).not.toHaveBeenCalled();
        fetchMock.mockRejectedValueOnce(new Error('Failed'));
        expect(await editScheduleMessage('123', '456', {})).toBe('retry');
    });
});
