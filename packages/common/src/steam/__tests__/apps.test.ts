import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearSteamAppListCache,
    parseSteamAppInput,
    resolveSteamAppInput,
    searchSteamApps,
    type SteamFetch,
} from '../apps.js';

const appList = [
    { appid: 730, name: 'Counter-Strike 2' },
    { appid: 570, name: 'Dota 2' },
    { appid: 620, name: 'Portal 2' },
    { appid: 400, name: 'Portal' },
    { appid: 10, name: 'Counter-Strike' },
];

function createFetch(apps = appList): SteamFetch {
    return vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            applist: {
                apps,
            },
        }),
    }));
}

beforeEach(() => {
    clearSteamAppListCache();
});

describe('Steam app resolver', () => {
    it('parses numeric IDs, autocomplete values, and Steam URLs', () => {
        expect(parseSteamAppInput('730')).toEqual({ steamAppId: 730 });
        expect(parseSteamAppInput('steam:570')).toEqual({ steamAppId: 570 });
        expect(parseSteamAppInput('Portal 2 (620)')).toEqual({ steamAppId: 620, appName: 'Portal 2' });
        expect(parseSteamAppInput('steam://rungameid/400')).toEqual({ steamAppId: 400 });
        expect(parseSteamAppInput('https://store.steampowered.com/app/730/CounterStrike_2/')).toEqual({
            steamAppId: 730,
            appName: 'CounterStrike 2',
        });
        expect(parseSteamAppInput('https://steamcommunity.com/app/570')).toEqual({ steamAppId: 570 });
        expect(parseSteamAppInput('Portal')).toBeNull();
    });

    it('ranks exact and prefix title matches', async () => {
        const results = await searchSteamApps('portal', { fetchImpl: createFetch() });

        expect(results.map((result) => result.steamAppId)).toEqual([400, 620]);
        expect(results[0]).toMatchObject({ appName: 'Portal', score: 1000 });
    });

    it('resolves direct IDs to the canonical app name when it is available', async () => {
        const result = await resolveSteamAppInput('https://store.steampowered.com/app/730/CounterStrike_2/', {
            fetchImpl: createFetch(),
        });

        expect(result).toEqual({
            status: 'resolved',
            app: {
                steamAppId: 730,
                appName: 'Counter-Strike 2',
                score: 1000,
            },
        });
    });

    it('returns ambiguous suggestions when no exact title wins', async () => {
        const result = await resolveSteamAppInput('counter', { fetchImpl: createFetch() });

        if (result.status !== 'ambiguous') {
            throw new Error(`Expected ambiguous result, got ${result.status}`);
        }
        expect(result.suggestions.map((suggestion) => suggestion.steamAppId)).toContain(730);
        expect(result.suggestions.map((suggestion) => suggestion.steamAppId)).toContain(10);
    });

    it('falls back to the public app list when the keyed store service fails', async () => {
        const fetchImpl = vi.fn<SteamFetch>()
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    applist: {
                        apps: appList,
                    },
                }),
            });

        const result = await resolveSteamAppInput('Dota 2', {
            fetchImpl,
            apiKey: 'test-key',
        });

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
            status: 'resolved',
            app: {
                steamAppId: 570,
                appName: 'Dota 2',
            },
        });
    });

    it('falls back to Steam Store search when the public app list returns 404', async () => {
        const fetchImpl = vi.fn<SteamFetch>()
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    total: 2,
                    items: [
                        { id: 620, name: 'Portal 2' },
                        { id: 400, name: 'Portal' },
                    ],
                }),
            });

        const result = await searchSteamApps('portal', { fetchImpl });

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
        expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('https://store.steampowered.com/api/storesearch/');
        expect(result.map((app) => app.steamAppId)).toEqual([400, 620]);
    });

    it('uses appdetails as a direct-id fallback when the public app list fails', async () => {
        const fetchImpl = vi.fn<SteamFetch>()
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    730: {
                        success: true,
                        data: {
                            steam_appid: 730,
                            name: 'Counter-Strike 2',
                        },
                    },
                }),
            });

        const result = await resolveSteamAppInput('730', { fetchImpl });

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('https://store.steampowered.com/api/appdetails');
        expect(result).toEqual({
            status: 'resolved',
            app: {
                steamAppId: 730,
                appName: 'Counter-Strike 2',
                score: 1000,
            },
        });
    });
});
