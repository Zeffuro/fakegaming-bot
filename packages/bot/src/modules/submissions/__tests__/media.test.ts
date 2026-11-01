import { describe, expect, it, vi } from 'vitest';
import { createCanvas } from 'canvas';
import { downloadSubmissionImages, SUBMISSION_IMAGE_LIMIT, validateImageInputs } from '../shared/media.js';

const png = createCanvas(2, 2).toBuffer('image/png');
const image = (overrides = {}) => ({ id: '123', url: 'https://cdn.discordapp.com/ephemeral-attachments/456/123/input.png?hm=secret',
    contentType: 'image/png', size: png.length, ...overrides });
const fetcher = (body: Uint8Array = png) => vi.fn(async () => new Response(Uint8Array.from(body).buffer)) as unknown as typeof fetch;

describe('submission screenshots', () => {
    it('downloads real PNG screenshots in submitted order with neutral filenames', async () => {
        const fetch = fetcher();
        const images = await downloadSubmissionImages([image(), image({ id: '124', url: 'https://cdn.discordapp.com/attachments/456/124/second.png' })], fetch);
        expect(images.map(value => value.name)).toEqual(['screenshot-1.png', 'screenshot-2.png']);
        expect(images[0]!.file.attachment).toEqual(png);
        expect(fetch).toHaveBeenCalledWith(image().url, expect.objectContaining({ redirect: 'error' }));
    });

    it.each([
        { url: 'http://cdn.discordapp.com/attachments/456/123/a.png' },
        { url: 'https://cdn.discordapp.com.evil.example/attachments/456/123/a.png' },
        { url: 'https://127.0.0.1/attachments/456/123/a.png' },
        { url: 'https://name:pass@cdn.discordapp.com/attachments/456/123/a.png' },
        { url: 'https://cdn.discordapp.com/attachments/456/124/a.png' },
        { url: 'https://cdn.discordapp.com/not-attachments/456/123/a.png' },
        { contentType: 'image/svg+xml' }, { contentType: null }, { id: '(a+)+' },
        { size: SUBMISSION_IMAGE_LIMIT + 1 }, { size: 0 }, { size: Number.NaN },
    ])('rejects unsafe attachment metadata before fetching (%j)', async overrides => {
        const fetch = fetcher();
        await expect(downloadSubmissionImages([image(overrides)], fetch)).rejects.toMatchObject({ code: 'imagesInvalid' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('enforces count and aggregate upload limits', () => {
        expect(() => validateImageInputs(Array.from({ length: 5 }, () => image()))).toThrow();
        expect(() => validateImageInputs(Array.from({ length: 3 }, () => image({ size: SUBMISSION_IMAGE_LIMIT })))).toThrow();
    });

    it('bounds streamed data even when the remote content exceeds the advertised size', async () => {
        await expect(downloadSubmissionImages([image({ size: 25 })], fetcher(png))).rejects.toMatchObject({ code: 'imagesInvalid' });
    });

    it('rejects a truncated file and MIME masquerading', async () => {
        await expect(downloadSubmissionImages([image()], fetcher(png.subarray(0, -1)))).rejects.toMatchObject({ code: 'imagesInvalid' });
        await expect(downloadSubmissionImages([image({ contentType: 'image/jpeg' })], fetcher())).rejects.toMatchObject({ code: 'imagesInvalid' });
        const script = Buffer.alloc(png.length, 65);
        await expect(downloadSubmissionImages([image()], fetcher(script))).rejects.toMatchObject({ code: 'imagesInvalid' });
    });

    it('rejects failed responses and does not fetch user-supplied content links', async () => {
        const fetch = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof globalThis.fetch;
        await expect(downloadSubmissionImages([image()], fetch)).rejects.toThrow();
        expect(await downloadSubmissionImages([], fetch)).toEqual([]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
