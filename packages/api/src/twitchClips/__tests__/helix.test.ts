import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTwitchClipBotToken, invalidateTwitchClipBotToken } from '../botAuth.js';
import { createTwitchCommandClip, getTwitchCommandClip, twitchClipHelix, TwitchClipApiError } from '../helix.js';

vi.mock('../botAuth.js', () => ({ getTwitchClipBotToken: vi.fn(), invalidateTwitchClipBotToken: vi.fn() }));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('TWITCH_CLIENT_ID', 'client-id');
    vi.mocked(getTwitchClipBotToken).mockResolvedValue({ accessToken: 'user-token', userId: 'bot-id', login: 'fakegamingbot' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('clip Helix transport', () => {
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
