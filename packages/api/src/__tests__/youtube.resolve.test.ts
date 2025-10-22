import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectOk } from '@zeffuro/fakegaming-common/testing';

const client = givenAuthenticatedClient(app);

describe('YouTube resolve endpoint', () => {
    const origKey = process.env.YOUTUBE_API_KEY;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        process.env.YOUTUBE_API_KEY = origKey;
        vi.restoreAllMocks();
        vi.resetAllMocks();
    });

    it('returns UC id passthrough without API key', async () => {
        delete process.env.YOUTUBE_API_KEY;
        const uc = 'UC' + 'a'.repeat(22); // matches /^UC[\w-]{22}$/
        const res = await client.get('/api/youtube/resolve').query({ identifier: uc });
        expectOk(res);
        expect(res.body).toEqual({ channelId: uc });
    });

    it('returns null when resolving handle without API key', async () => {
        delete process.env.YOUTUBE_API_KEY;
        const res = await client.get('/api/youtube/resolve').query({ identifier: '@somehandle' });
        expectOk(res);
        expect(res.body).toEqual({ channelId: null });
    });

    it('resolves handle via YouTube Data API when API key is set', async () => {
        process.env.YOUTUBE_API_KEY = 'test-key';
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: [{ id: 'UCresolved123' }] }),
        } as any);
        const res = await client.get('/api/youtube/resolve').query({ identifier: '@abc' });
        expectOk(res);
        expect(res.body).toEqual({ channelId: 'UCresolved123' });
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('resolves username via YouTube Data API when API key is set', async () => {
        process.env.YOUTUBE_API_KEY = 'test-key';
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: [{ id: 'UCuser123' }] }),
        } as any);
        const res = await client.get('/api/youtube/resolve').query({ identifier: 'someUserName' });
        expectOk(res);
        expect(res.body).toEqual({ channelId: 'UCuser123' });
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('returns null when API responds not ok', async () => {
        process.env.YOUTUBE_API_KEY = 'test-key';
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false } as any);
        const res = await client.get('/api/youtube/resolve').query({ identifier: '@abc' });
        expectOk(res);
        expect(res.body).toEqual({ channelId: null });
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('returns null when API throws', async () => {
        process.env.YOUTUBE_API_KEY = 'test-key';
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('network'));
        const res = await client.get('/api/youtube/resolve').query({ identifier: '@abc' });
        expectOk(res);
        expect(res.body).toEqual({ channelId: null });
        expect(fetchSpy).toHaveBeenCalled();
    });
});
