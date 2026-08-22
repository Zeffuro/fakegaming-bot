import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getTmdbMedia,
    searchTmdbMedia,
    TmdbAuthenticationError,
    TmdbConfigurationError,
} from '../tmdbService.js';

describe('TMDB service', () => {
    beforeEach(() => {
        vi.stubEnv('TMDB_API_TOKEN', 'test-token');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('searches movies and TV while filtering people and adult results', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            results: [
                { id: 1, media_type: 'movie', title: 'Dune', release_date: '2021-09-15', adult: false },
                { id: 2, media_type: 'tv', name: 'Dune: Prophecy', first_air_date: '2024-11-17', adult: false },
                { id: 3, media_type: 'person', name: 'Someone' },
                { id: 4, media_type: 'movie', title: 'Adult result', adult: true },
            ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const results = await searchTmdbMedia('Dune', 'all', 'nl');

        expect(results.map(result => [result.id, result.type, result.title])).toEqual([
            [1, 'movie', 'Dune'],
            [2, 'tv', 'Dune: Prophecy'],
        ]);
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.pathname).toBe('/3/search/multi');
        expect(url.searchParams.get('language')).toBe('nl-NL');
        expect(url.searchParams.get('include_adult')).toBe('false');
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-token');
    });

    it('normalizes movie details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            id: 438631,
            title: 'Dune',
            original_title: 'Dune',
            overview: 'A desert epic.',
            release_date: '2021-09-15',
            runtime: 155,
            genres: [{ id: 878, name: 'Science Fiction' }],
            adult: false,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

        await expect(getTmdbMedia('movie', 438631)).resolves.toMatchObject({
            id: 438631,
            type: 'movie',
            title: 'Dune',
            runtimeMinutes: 155,
            genres: ['Science Fiction'],
        });
    });

    it('accepts a v3 API key in either supported environment variable', async () => {
        const fetchMock = vi.fn().mockImplementation(async () => (
            new Response(JSON.stringify({ results: [] }), { status: 200 })
        ));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('TMDB_API_TOKEN', '0123456789abcdef0123456789abcdef');

        await searchTmdbMedia('Dune');

        let [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.searchParams.get('api_key')).toBe('0123456789abcdef0123456789abcdef');
        expect(new Headers(init.headers).has('Authorization')).toBe(false);

        vi.stubEnv('TMDB_API_TOKEN', '');
        vi.stubEnv('TMDB_API_KEY', 'fedcba9876543210fedcba9876543210');
        await searchTmdbMedia('Dune');

        [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
        expect(url.searchParams.get('api_key')).toBe('fedcba9876543210fedcba9876543210');
        expect(new Headers(init.headers).has('Authorization')).toBe(false);
    });

    it('normalizes a pasted Bearer prefix', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('TMDB_API_TOKEN', 'Bearer test-read-token');

        await searchTmdbMedia('Dune');

        const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-read-token');
    });

    it('distinguishes missing configuration and provider failures', async () => {
        vi.stubEnv('TMDB_API_TOKEN', '');
        vi.stubGlobal('fetch', vi.fn());
        await expect(searchTmdbMedia('Dune')).rejects.toBeInstanceOf(TmdbConfigurationError);

        vi.stubEnv('TMDB_API_TOKEN', 'test-token');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
        await expect(searchTmdbMedia('Dune')).rejects.toMatchObject({ status: 503 });

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
        await expect(searchTmdbMedia('Dune')).rejects.toBeInstanceOf(TmdbAuthenticationError);
    });
});
