import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, API_ENDPOINTS } from '@/lib/api-client.js';

const globalAny: any = globalThis as any;

describe('api-client', () => {
    beforeEach(() => {
        globalAny.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalAny.fetch;
    });

    it('getTwitchConfigs performs GET and returns data', async () => {
        const payload = { items: [{ id: '1' }] };
        globalAny.fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
        const result = await api.getTwitchConfigs();
        expect(globalAny.fetch).toHaveBeenCalledWith(API_ENDPOINTS.TWITCH, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(payload);
    });

    it('createTwitchStream performs POST with body', async () => {
        const payload = { id: 'abc', name: 'stream' };
        const response = { id: 'abc' };
        globalAny.fetch.mockResolvedValueOnce({ ok: true, json: async () => response });
        const result = await api.createTwitchStream(payload as any);
        expect(globalAny.fetch).toHaveBeenCalledWith(
            API_ENDPOINTS.TWITCH,
            expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) })
        );
        expect(result).toEqual(response);
    });

    it('deleteTwitchStream performs DELETE', async () => {
        const response = { success: true };
        globalAny.fetch.mockResolvedValueOnce({ ok: true, json: async () => response });
        const result = await api.deleteTwitchStream('123');
        expect(globalAny.fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.TWITCH}/123`, expect.objectContaining({ method: 'DELETE' }));
        expect(result).toEqual(response);
    });

    it('getYouTubeConfigs performs GET', async () => {
        const payload = { items: [] };
        globalAny.fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
        const result = await api.getYouTubeConfigs();
        expect(globalAny.fetch).toHaveBeenCalledWith(API_ENDPOINTS.YOUTUBE, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(payload);
    });

    it('createYouTubeChannel performs POST', async () => {
        const payload = { channelId: 'cid' };
        const response = { success: true };
        globalAny.fetch.mockResolvedValueOnce({ ok: true, json: async () => response });
        const result = await api.createYouTubeChannel(payload as any);
        expect(globalAny.fetch).toHaveBeenCalledWith(
            API_ENDPOINTS.YOUTUBE,
            expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) })
        );
        expect(result).toEqual(response);
    });

    it('deleteYouTubeChannel performs DELETE', async () => {
        const response = { success: true };
        globalAny.fetch.mockResolvedValueOnce({ ok: true, json: async () => response });
        const result = await api.deleteYouTubeChannel('abc');
        expect(globalAny.fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.YOUTUBE}/abc`, expect.objectContaining({ method: 'DELETE' }));
        expect(result).toEqual(response);
    });

    it('apiRequest throws with server error payload message', async () => {
        globalAny.fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Bad stuff' }) });
        await expect(api.getYouTubeConfigs()).rejects.toThrow('Bad stuff');
    });

    it('apiRequest throws with generic message if no json', async () => {
        globalAny.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
        await expect(api.getTwitchConfigs()).rejects.toThrow('API request failed with status: 500');
    });
});
