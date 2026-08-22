import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchAniListAnimePage } from '../anilistClient.js';

describe('AniList client failures', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns structured API suspension details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            errors: [{ message: 'The AniList API has been temporarily disabled.', status: 403 }],
            data: null,
        }), { status: 403, headers: { 'Content-Type': 'application/json' } })));

        const result = await searchAniListAnimePage('Death Note');

        expect(result.items).toEqual([]);
        expect(result.failure).toEqual({ kind: 'unavailable', status: 403, retryAfterSeconds: null });
    });

    it('preserves rate-limit retry information', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            errors: [{ message: 'Too Many Requests.', status: 429 }],
            data: null,
        }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } })));

        const result = await searchAniListAnimePage('Death Note');

        expect(result.failure).toEqual({ kind: 'rate-limited', status: 429, retryAfterSeconds: 30 });
    });

    it('continues to return successful search results', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: {
                Page: {
                    media: [{ id: 1535, title: { english: 'Death Note' } }],
                    pageInfo: { currentPage: 1, hasNextPage: false, perPage: 10, total: 1 },
                },
            },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

        const result = await searchAniListAnimePage('Death Note');

        expect(result.failure).toBeUndefined();
        expect(result.items).toEqual([{ id: 1535, title: { english: 'Death Note' } }]);
    });
});
