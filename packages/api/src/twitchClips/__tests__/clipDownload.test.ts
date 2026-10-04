import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTwitchClipDownload } from '../clipDownload.js';

const fetchMock = vi.fn<typeof fetch>();
let nextId = 0;
const response = (sourceURL = 'https://production.media.clips.twitchcdn.net/video-1080.mp4') => [{ data: { clip: {
    playbackAccessToken: { signature: 'signature', value: '{"expires":1234}' },
    videoQualities: [
        { quality: '720', sourceURL: 'https://clips-media-assets2.twitch.tv/video-720.mp4' },
        { quality: '1080', sourceURL },
    ],
} } }];

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('optional Twitch clip download', () => {
    it('returns the highest quality signed URL and shares concurrent lookups', async () => {
        fetchMock.mockResolvedValueOnce(Response.json(response()));
        const id = `public-${nextId++}`;
        const [first, second] = await Promise.all([getTwitchClipDownload(id), getTwitchClipDownload(id)]);
        expect(first).toBe(second);
        const url = new URL(first!);
        expect(url.pathname).toBe('/video-1080.mp4');
        expect(url.searchParams.get('sig')).toBe('signature');
        expect(url.searchParams.get('token')).toBe('{"expires":1234}');
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://gql.twitch.tv/gql', expect.objectContaining({ method: 'POST' }));
        const init = fetchMock.mock.calls[0][1]!;
        expect(init.headers).not.toHaveProperty('Authorization');
        expect(JSON.parse(init.body as string)[0].variables.slug).toBe(id);
    });

    it('accepts the observed CloudFront clip host', async () => {
        fetchMock.mockResolvedValueOnce(Response.json(response('https://d1ndex63qxojbr.cloudfront.net/clip.mp4')));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toContain('d1ndex63qxojbr.cloudfront.net/clip.mp4?');
    });

    it.each(['http://localhost/clip.mp4', 'https://evil.example/clip.mp4', 'https://clips-media-assets2.twitch.tv.evil.example/clip.mp4', 'https://user:password@clips-media-assets2.twitch.tv/clip.mp4', 'https://clips-media-assets2.twitch.tv:8080/clip.mp4', 'https://clips-media-assets2.twitch.tv/thumb.jpg'])('rejects untrusted media URLs: %s', async sourceURL => {
        const data = response(sourceURL);
        data[0].data.clip.videoQualities = [{ quality: '1080', sourceURL }];
        fetchMock.mockResolvedValueOnce(Response.json(data));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('omits unavailable downloads on errors, invalid responses or oversized links', async () => {
        fetchMock.mockRejectedValueOnce(new Error('timeout'));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toBeUndefined();
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toBeUndefined();
        fetchMock.mockResolvedValueOnce(Response.json([{ errors: [{ message: 'PersistedQueryNotFound' }] }]));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toBeUndefined();
        fetchMock.mockResolvedValueOnce(Response.json([{ data: { clip: null } }]));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toBeUndefined();
        fetchMock.mockResolvedValueOnce(Response.json(response('https://production.media.clips.twitchcdn.net/'+ 'x'.repeat(1000) + '.mp4')));
        expect(await getTwitchClipDownload(`public-${nextId++}`)).toContain('video-720.mp4');
    });

    it('rejects invalid clip IDs without contacting Twitch', async () => {
        expect(await getTwitchClipDownload('../bad')).toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
