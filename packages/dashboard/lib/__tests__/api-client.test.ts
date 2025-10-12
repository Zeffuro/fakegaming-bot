import { describe, it, expect } from 'vitest';
import { api, API_ENDPOINTS } from '@/lib/api-client';
import { withFetchMock } from '@zeffuro/fakegaming-common/testing';

const { mockOkJsonOnce, mockErrorJsonOnce, expectFetchCalledWith, getFetchMock } = withFetchMock();

describe('api-client', () => {
    it('getTwitchConfigs performs GET and returns data', async () => {
        const payload = { items: [{ id: '1' }] };
        mockOkJsonOnce(payload);
        const result = await api.getTwitchConfigs();
        expectFetchCalledWith(API_ENDPOINTS.TWITCH, { method: 'GET' });
        expect(result).toEqual(payload);
    });

    it('createTwitchStream performs POST with body', async () => {
        const payload = { id: 'abc', name: 'stream' };
        const response = { id: 'abc' };
        mockOkJsonOnce(response);
        const result = await api.createTwitchStream(payload as any);
        expectFetchCalledWith(API_ENDPOINTS.TWITCH, { method: 'POST', body: JSON.stringify(payload) });
        expect(result).toEqual(response);
    });

    it('deleteTwitchStream performs DELETE', async () => {
        const response = { success: true };
        mockOkJsonOnce(response);
        const result = await api.deleteTwitchStream('123');
        expectFetchCalledWith(`${API_ENDPOINTS.TWITCH}/123`, { method: 'DELETE' });
        expect(result).toEqual(response);
    });

    it('getYouTubeConfigs performs GET', async () => {
        const payload = { items: [] };
        mockOkJsonOnce(payload);
        const result = await api.getYouTubeConfigs();
        expectFetchCalledWith(API_ENDPOINTS.YOUTUBE, { method: 'GET' });
        expect(result).toEqual(payload);
    });

    it('createYouTubeChannel performs POST', async () => {
        const payload = { channelId: 'cid' };
        const response = { success: true };
        mockOkJsonOnce(response);
        const result = await api.createYouTubeChannel(payload as any);
        expectFetchCalledWith(API_ENDPOINTS.YOUTUBE, { method: 'POST', body: JSON.stringify(payload) });
        expect(result).toEqual(response);
    });

    it('deleteYouTubeChannel performs DELETE', async () => {
        const response = { success: true };
        mockOkJsonOnce(response);
        const result = await api.deleteYouTubeChannel('abc');
        expectFetchCalledWith(`${API_ENDPOINTS.YOUTUBE}/abc`, { method: 'DELETE' });
        expect(result).toEqual(response);
    });

    it('getSupportedGames performs GET and returns string[]', async () => {
        const payload = ['League of Legends', 'Valorant'];
        mockOkJsonOnce(payload);
        const result = await api.getSupportedGames();
        expectFetchCalledWith(`${API_ENDPOINTS.PATCH_NOTES}/supportedGames`, { method: 'GET' });
        expect(result).toEqual(payload);
    });

    it('getLatestPatchNote performs GET and returns patch note object', async () => {
        const payload = { game: 'League of Legends', version: '14.19', publishedAt: Date.now() };
        mockOkJsonOnce(payload);
        const result = await api.getLatestPatchNote('League of Legends');
        expectFetchCalledWith(`${API_ENDPOINTS.PATCH_NOTES}/League%20of%20Legends`, { method: 'GET' });
        expect(result).toEqual(payload);
    });

    it('apiRequest throws with server error payload message', async () => {
        mockErrorJsonOnce(400, { error: 'Bad stuff' });
        await expect(api.getYouTubeConfigs()).rejects.toThrow('Bad stuff');
    });

    it('apiRequest throws with generic message if no json', async () => {
        getFetchMock().mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
        await expect(api.getTwitchConfigs()).rejects.toThrow('API request failed with status: 500');
    });
});
