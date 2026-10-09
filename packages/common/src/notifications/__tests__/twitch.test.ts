import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

describe('private Twitch lookups', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv('TWITCH_CLIENT_ID', 'test-client'); vi.stubEnv('TWITCH_CLIENT_SECRET', 'test-secret');
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

    it('shares token acquisition across concurrent lookups and validates user identity', async () => {
        const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('oauth2')
            ? { access_token: 'token', expires_in: 3600 } : { data: [{ id: '1', login: 'example', display_name: 'Example' }] }), { status: 200 }));
        vi.stubGlobal('fetch', fetch);
        const api = await import('../twitch.js');
        const [first, second] = await Promise.all([api.findPersonalTwitchUser('@Example'), api.findPersonalTwitchUser('example')]);
        expect(first?.id).toBe('1'); expect(second?.id).toBe('1');
        expect(fetch.mock.calls.filter(call => call[0].includes('oauth2'))).toHaveLength(1);
        expect(await api.findPersonalTwitchUser('bad/name')).toBeNull();
    });

    it('deduplicates and batches 101 channels with the full stream page size', async () => {
        const fetch = vi.fn(async (url: string) => {
            if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'token' }));
            const parameters = new URL(url).searchParams;
            expect(parameters.get('first')).toBe('100');
            const logins = parameters.getAll('user_login');
            expect(logins.length).toBeLessThanOrEqual(100);
            return new Response(JSON.stringify({ data: logins.map(login => ({ id: login, user_login: login, user_name: login, title: 'Live', started_at: '2026-10-07T10:00Z' })) }));
        });
        vi.stubGlobal('fetch', fetch);
        const api = await import('../twitch.js');
        const logins = Array.from({ length: 101 }, (_, index) => `user${index}`);
        expect(await api.fetchPersonalTwitchStreams([...logins, ...logins])).toHaveLength(101);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('surfaces provider errors and drops malformed stream rows', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token' })))
            .mockResolvedValueOnce(new Response('{}', { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'missing-fields' }] })));
        vi.stubGlobal('fetch', fetch);
        const api = await import('../twitch.js');
        await expect(api.fetchPersonalTwitchStreams(['example'])).rejects.toThrow('twitch-503');
        expect(await api.fetchPersonalTwitchStreams(['example'])).toEqual([]);
    });
});
