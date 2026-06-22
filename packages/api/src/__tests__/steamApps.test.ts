import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectConflict, expectNotFound, expectOk } from '@zeffuro/fakegaming-common/testing';

const appList = [
    { appid: 730, name: 'Counter-Strike 2' },
    { appid: 570, name: 'Dota 2' },
    { appid: 400, name: 'Portal' },
    { appid: 620, name: 'Portal 2' },
    { appid: 10, name: 'Counter-Strike' },
];

async function loadClient() {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            applist: {
                apps: appList,
            },
        }),
    })));
    const { givenAuthenticatedClient } = await import('@zeffuro/fakegaming-common/testing');
    const { default: app } = await import('../app.js');
    return givenAuthenticatedClient(app);
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

describe('Steam apps API', () => {
    it('searches Steam apps by title', async () => {
        const client = await loadClient();

        const response = await client.get('/api/steamApps/search').query({ q: 'portal', limit: 2 });

        expectOk(response);
        expect(response.body.results).toHaveLength(2);
        expect(response.body.results[0]).toMatchObject({
            steamAppId: 400,
            appName: 'Portal',
        });
    });

    it('resolves Steam URLs to app metadata', async () => {
        const client = await loadClient();

        const response = await client.get('/api/steamApps/resolve').query({
            q: 'https://store.steampowered.com/app/730/CounterStrike_2/',
        });

        expectOk(response);
        expect(response.body).toMatchObject({
            steamAppId: 730,
            appName: 'Counter-Strike 2',
        });
    });

    it('reports missing apps', async () => {
        const client = await loadClient();

        const response = await client.get('/api/steamApps/resolve').query({ q: 'not a real game' });

        expectNotFound(response);
    });

    it('reports ambiguous title matches with suggestions', async () => {
        const client = await loadClient();

        const response = await client.get('/api/steamApps/resolve').query({ q: 'counter' });

        expectConflict(response);
        expect(response.body.error.code).toBe('STEAM_APP_AMBIGUOUS');
        expect(response.body.error.suggestions).toEqual(expect.arrayContaining([
            expect.objectContaining({ steamAppId: 730 }),
            expect.objectContaining({ steamAppId: 10 }),
        ]));
    });
});
