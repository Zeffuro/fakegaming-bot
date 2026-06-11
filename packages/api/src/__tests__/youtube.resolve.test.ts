import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectBadRequest, expectOk } from '@zeffuro/fakegaming-common/testing';

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

    it('accepts alternate identifier query keys', async () => {
        delete process.env.YOUTUBE_API_KEY;
        const uc = 'UC' + 'b'.repeat(22);

        for (const key of ['id', 'channelId', 'handle', 'username']) {
            const value = key === 'id' || key === 'channelId' ? uc : '@somehandle';
            const res = await client.get('/api/youtube/resolve').query({ [key]: value });

            expectOk(res);
            expect(res.body).toEqual({ channelId: key === 'id' || key === 'channelId' ? uc : null });
        }
    });

    it('normalizes repeated identifier values using the first value', async () => {
        delete process.env.YOUTUBE_API_KEY;
        const uc = 'UC' + 'c'.repeat(22);
        const res = await client
            .get('/api/youtube/resolve')
            .query(`identifier=${encodeURIComponent(` ${uc} `)}&identifier=ignored`);

        expectOk(res);
        expect(res.body).toEqual({ channelId: uc });
    });

    it('returns 400 when repeated identifier values start empty', async () => {
        const res = await client
            .get('/api/youtube/resolve')
            .query('identifier=%20&identifier=@ignored');

        expectBadRequest(res);
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

    it('returns null when API response has no channel item', async () => {
        process.env.YOUTUBE_API_KEY = 'test-key';
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: [] }),
        } as any);
        const res = await client.get('/api/youtube/resolve').query({ identifier: '@abc' });
        expectOk(res);
        expect(res.body).toEqual({ channelId: null });
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

describe('YouTube metadata endpoint', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetAllMocks();
    });

    it('reads public channel metadata from the Atom feed', async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <title>Test &amp; Channel</title>
  <author>
    <name>Test &amp; Channel</name>
    <uri>https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa</uri>
  </author>
  <entry>
    <yt:videoId>video123</yt:videoId>
    <title>Latest video</title>
  </entry>
</feed>`;
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
            ok: true,
            text: async () => xml,
        } as any);

        const res = await client.get('/api/youtube/metadata').query({ channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa' });

        expectOk(res);
        expect(res.body).toEqual({
            channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
            title: 'Test & Channel',
            url: 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa',
            latestVideoId: 'video123',
        });
        expect(fetchSpy).toHaveBeenCalledWith(
            'https://www.youtube.com/feeds/videos.xml?channel_id=UCaaaaaaaaaaaaaaaaaaaaaa',
            expect.objectContaining({ headers: expect.any(Object) })
        );
    });

    it('falls back to null fields when the feed is unavailable', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false } as any);

        const res = await client.get('/api/youtube/metadata').query({ channelId: 'UCmissing' });

        expectOk(res);
        expect(res.body).toEqual({
            channelId: 'UCmissing',
            title: null,
            url: 'https://www.youtube.com/channel/UCmissing',
            latestVideoId: null,
        });
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('falls back to the public channel page when the Atom feed is unavailable', async () => {
        const html = `
<html>
  <head>
    <title>Qucee - YouTube</title>
    <meta property="og:title" content="Qucee">
    <meta property="og:url" content="https://www.youtube.com/channel/UCfqnx4kPKA4kaaUDODirUwg">
  </head>
  <body>
    <script>{"videoId":"abc123xyz","title":{"runs":[{"text":"Latest public video"}]}}</script>
  </body>
</html>`;
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any)
            .mockResolvedValueOnce({ ok: false, status: 404 } as any)
            .mockResolvedValueOnce({ ok: true, text: async () => html } as any);

        const res = await client.get('/api/youtube/metadata').query({ channelId: 'UCfqnx4kPKA4kaaUDODirUwg' });

        expectOk(res);
        expect(res.body).toEqual({
            channelId: 'UCfqnx4kPKA4kaaUDODirUwg',
            title: 'Qucee',
            url: 'https://www.youtube.com/channel/UCfqnx4kPKA4kaaUDODirUwg',
            latestVideoId: 'abc123xyz',
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('falls back to null fields when the feed request throws', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('network'));

        const res = await client.get('/api/youtube/metadata').query({ channelId: 'UCnetwork' });

        expectOk(res);
        expect(res.body).toEqual({
            channelId: 'UCnetwork',
            title: null,
            url: null,
            latestVideoId: null,
        });
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('returns 400 when channelId is missing', async () => {
        const res = await client.get('/api/youtube/metadata');
        expectBadRequest(res);
    });
});
