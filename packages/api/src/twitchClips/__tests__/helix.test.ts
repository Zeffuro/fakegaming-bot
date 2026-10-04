import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTwitchClipBotToken, invalidateTwitchClipBotToken } from '../botAuth.js';
import { createTwitchCommandClip, getTwitchCommandClip, getTwitchClipCategory, twitchClipHelix, TwitchClipApiError, sendTwitchClipChatMessage } from '../helix.js';

vi.mock('../botAuth.js', () => ({ getTwitchClipBotToken: vi.fn(), invalidateTwitchClipBotToken: vi.fn() }));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('TWITCH_CLIENT_ID', 'client-id');
    vi.mocked(getTwitchClipBotToken).mockResolvedValue({ accessToken: 'user-token', userId: 'bot-id', login: 'fakegamingbot' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('clip Helix transport', () => {
    it('encodes optional titles without changing clip creation permissions', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: 'Clip_slug' }] }, { status: 202 }));
        await createTwitchCommandClip('123', 30, 'Nice play & win!');
        const url = new URL(fetchMock.mock.calls[0][0] as string);
        expect(url.searchParams.get('title')).toBe('Nice play & win!');
        expect(url.searchParams.get('broadcaster_id')).toBe('123');
    });

    it('enriches categories once and degrades safely when optional metadata is unavailable', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: '1234', name: 'Minecraft' }] }));
        expect(await getTwitchClipCategory('1234')).toBe('Minecraft');
        expect(await getTwitchClipCategory('1234')).toBe('Minecraft');
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(await getTwitchClipCategory(undefined)).toBeUndefined();
        expect(await getTwitchClipCategory('../bad')).toBeUndefined();
        fetchMock.mockRejectedValueOnce(new Error('network down'));
        expect(await getTwitchClipCategory('1235')).toBeUndefined();
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: 'other', name: 'Wrong category' }] }));
        expect(await getTwitchClipCategory('1236')).toBeUndefined();
    });
    it('sends an actual threaded chat reply with the bot user identity and checks dropped messages', async () => {
        const token = { accessToken: 'user-token', userId: 'bot-id', login: 'clipbot', chatReplyAuthorized: true };
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ is_sent: true }] }));
        await sendTwitchClipChatMessage('123', 'command-id', 'Clip created!', token);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.twitch.tv/helix/chat/messages', expect.objectContaining({
            method: 'POST', body: JSON.stringify({ broadcaster_id: '123', sender_id: 'bot-id', message: 'Clip created!', reply_parent_message_id: 'command-id' }),
        }));
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ is_sent: false, drop_reason: { code: 'automod_held' } }] }));
        await expect(sendTwitchClipChatMessage('123', 'command-id', 'Clip created!', token)).rejects.toThrow('dropped');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it('uses the bot user token and duration when creating a clip', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: 'Clip_slug' }] }, { status: 202 }));
        expect(await createTwitchCommandClip('123', 45)).toBe('Clip_slug');
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.twitch.tv/helix/clips?broadcaster_id=123&duration=45', expect.objectContaining({
            method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer user-token', 'Client-Id': 'client-id' }),
        }));
    });

    it('invalidates a rejected token without blindly repeating clip creation', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
        await expect(createTwitchCommandClip('123', 30)).rejects.toMatchObject({ status: 401 });
        expect(invalidateTwitchClipBotToken).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('reports provider errors and rejects a missing or invalid clip ID', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
        await expect(twitchClipHelix('clips')).rejects.toBeInstanceOf(TwitchClipApiError);
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: '../bad' }] }));
        await expect(createTwitchCommandClip('123', 30)).rejects.toThrow('valid clip ID');
        fetchMock.mockResolvedValueOnce(Response.json({ data: [] }));
        await expect(createTwitchCommandClip('123', 30)).rejects.toThrow('valid clip ID');
    });

    it('waits for asynchronous creation and only returns the requested clip', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ data: [] }));
        expect(await getTwitchCommandClip('Clip_slug')).toBeNull();
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: 'other' }] }));
        expect(await getTwitchCommandClip('Clip_slug')).toBeNull();
        const clip = { id: 'Clip_slug', broadcaster_id: '123' };
        fetchMock.mockResolvedValueOnce(Response.json({ data: [clip] }));
        expect(await getTwitchCommandClip('Clip_slug')).toEqual(clip);
    });
});
