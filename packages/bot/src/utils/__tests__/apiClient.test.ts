import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fetchLatestPatchNoteApi,
    getApiBaseUrl,
    resolveYoutubeChannelIdApi,
    verifyTwitchUsernameApi
} from '../apiClient.js';

function createResponse(options: {
    ok?: boolean;
    status?: number;
    json?: unknown;
    text?: string;
    textRejects?: boolean;
}): Response {
    return {
        ok: options.ok ?? true,
        status: options.status ?? 200,
        json: vi.fn(async () => options.json),
        text: vi.fn(async () => {
            if (options.textRejects) {
                throw new Error('body unavailable');
            }
            return options.text ?? JSON.stringify(options.json);
        })
    } as unknown as Response;
}

describe('apiClient', () => {
    let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

    beforeEach(() => {
        vi.unstubAllEnvs();
        fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('normalizes API base URLs from defaults and environment values', () => {
        expect(getApiBaseUrl()).toBe('http://localhost:3001/api');

        vi.stubEnv('BOT_API_URL', ' https://bot.example.test/base/ ');
        expect(getApiBaseUrl()).toBe('https://bot.example.test/base/api');

        vi.stubEnv('BOT_API_URL', 'https://bot.example.test/api');
        expect(getApiBaseUrl()).toBe('https://bot.example.test/api');

        vi.stubEnv('BOT_API_URL', '');
        vi.stubEnv('API_URL', 'https://api.example.test/');
        expect(getApiBaseUrl()).toBe('https://api.example.test/api');
    });

    it('verifies Twitch usernames with service-token headers', async () => {
        vi.stubEnv('BOT_API_URL', 'https://api.example.test');
        vi.stubEnv('SERVICE_API_TOKEN', ' token-123 ');
        fetchMock.mockResolvedValueOnce(createResponse({
            json: { exists: true, id: 'id-1', login: 'creator', displayName: 'Creator' }
        }));

        await expect(verifyTwitchUsernameApi('creator')).resolves.toEqual({
            exists: true,
            id: 'id-1',
            login: 'creator',
            displayName: 'Creator'
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.example.test/api/twitch/verify?username=creator',
            { headers: { 'x-service-token': 'token-123' } }
        );
    });

    it('handles Twitch verifier empty input, non-OK responses, invalid payloads, and request failures', async () => {
        await expect(verifyTwitchUsernameApi('')).resolves.toEqual({ exists: false });

        fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 500, json: { error: 'down' } }));
        await expect(verifyTwitchUsernameApi('down')).resolves.toEqual({ exists: false });

        fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 502, text: 'bad gateway' }));
        await expect(verifyTwitchUsernameApi('text-error')).resolves.toEqual({ exists: false });

        fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 503, textRejects: true }));
        await expect(verifyTwitchUsernameApi('no-body')).resolves.toEqual({ exists: false });

        fetchMock.mockResolvedValueOnce(createResponse({ json: { exists: 'yes' } }));
        await expect(verifyTwitchUsernameApi('invalid')).resolves.toEqual({ exists: false });

        fetchMock.mockRejectedValueOnce(new Error('network'));
        await expect(verifyTwitchUsernameApi('network')).resolves.toBeNull();
    });

    it('resolves YouTube identifiers and rejects malformed resolver payloads', async () => {
        await expect(resolveYoutubeChannelIdApi('')).resolves.toBeNull();

        fetchMock.mockResolvedValueOnce(createResponse({ json: { channelId: 'UC123' } }));
        await expect(resolveYoutubeChannelIdApi('@creator')).resolves.toBe('UC123');

        fetchMock.mockResolvedValueOnce(createResponse({ json: { channelId: null } }));
        await expect(resolveYoutubeChannelIdApi('@missing')).resolves.toBeNull();

        fetchMock.mockResolvedValueOnce(createResponse({ json: { channelId: 123 } }));
        await expect(resolveYoutubeChannelIdApi('@bad')).resolves.toBeNull();

        fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 404, text: '{"error":"missing"}' }));
        await expect(resolveYoutubeChannelIdApi('@notfound')).resolves.toBeNull();

        fetchMock.mockRejectedValueOnce(new Error('network'));
        await expect(resolveYoutubeChannelIdApi('@network')).resolves.toBeNull();
    });

    it('fetches latest patch notes from direct and wrapped API payloads', async () => {
        fetchMock.mockResolvedValueOnce(createResponse({
            json: {
                game: 'Game',
                title: 'Patch 1',
                url: 'https://example.test/patch',
                publishedAt: '2026-06-09T00:00:00.000Z'
            }
        }));
        await expect(fetchLatestPatchNoteApi('Game')).resolves.toMatchObject({
            game: 'Game',
            title: 'Patch 1',
            content: '',
            url: 'https://example.test/patch',
            imageUrl: null,
            logoUrl: null,
            accentColor: null
        });

        fetchMock.mockResolvedValueOnce(createResponse({
            json: {
                patch: {
                    game: 'Game',
                    title: 'Patch 2',
                    content: 'notes',
                    url: 'https://example.test/patch-2',
                    publishedAt: '2026-06-09T01:00:00.000Z',
                    imageUrl: 'https://example.test/image.png',
                    logoUrl: 'https://example.test/logo.png',
                    accentColor: 123
                }
            }
        }));
        await expect(fetchLatestPatchNoteApi('Game 2')).resolves.toMatchObject({
            title: 'Patch 2',
            content: 'notes',
            accentColor: 123
        });
    });

    it('returns null for latest patch note empty input, non-OK responses, invalid payloads, and request failures', async () => {
        await expect(fetchLatestPatchNoteApi('')).resolves.toBeNull();

        fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 404 }));
        await expect(fetchLatestPatchNoteApi('missing')).resolves.toBeNull();

        fetchMock.mockResolvedValueOnce(createResponse({ json: { title: 'No URL' } }));
        await expect(fetchLatestPatchNoteApi('invalid')).resolves.toBeNull();

        fetchMock.mockRejectedValueOnce(new Error('network'));
        await expect(fetchLatestPatchNoteApi('network')).resolves.toBeNull();
    });
});
