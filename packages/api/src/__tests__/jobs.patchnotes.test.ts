import '../vitest.setup.js';
import { describe, it, expect } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectOk, expectUnauthorized, expectServiceUnavailable, expectErrorCode } from '@zeffuro/fakegaming-common/testing';
import { buildPatchNoteEmbedPayload, computeNextQuarterHourDelaySeconds } from '../jobs/patchNotes.js';

const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

describe('Jobs — patchnotes admin endpoints', () => {
    it('GET /api/jobs includes patchnotes', async () => {
        const res = await client.get('/api/jobs');
        expectOk(res);
        const names = (res.body.jobs as Array<{ name: string }>).map(j => j.name);
        expect(names).toContain('patchnotes');
    });

    it('POST /api/jobs/patchnotes/run returns 503 when queue is unavailable', async () => {
        const res = await client.post('/api/jobs/patchnotes/run').send({});
        expectServiceUnavailable(res);
        expectErrorCode(res as any, 'JOBS_UNAVAILABLE');
    });

    it('GET /api/jobs without auth returns 401', async () => {
        const res = await client.raw.get('/api/jobs');
        expectUnauthorized(res);
    });
});

describe('Patchnotes job utils', () => {
    it('computeNextQuarterHourDelaySeconds computes a positive delay to next quarter', () => {
        const base = new Date(2025, 0, 1, 10, 0, 0, 0); // 10:00:00.000 local
        const delay = computeNextQuarterHourDelaySeconds(base);
        expect(delay).toBeGreaterThan(0);
        // From 10:00 -> next quarter is 10:15 -> 900s
        expect(delay).toBe(900);
        const near = new Date(2025, 0, 1, 10, 14, 50, 0);
        const delay2 = computeNextQuarterHourDelaySeconds(near);
        // ~10 seconds to next quarter, but minSeconds=5 applies -> >= 5
        expect(delay2).toBeGreaterThanOrEqual(5);
        expect(delay2).toBeLessThanOrEqual(15);
    });

    it('buildPatchNoteEmbedPayload produces a single embed with truncated description', () => {
        const long = 'x'.repeat(500);
        const payload = buildPatchNoteEmbedPayload({
            game: 'Test Game',
            title: 'Patch 1.2',
            content: long,
            url: 'https://example.com/patch',
            publishedAt: Date.now(),
            logoUrl: 'https://example.com/logo.png',
            imageUrl: 'https://example.com/image.png',
            version: '1.2.0',
            accentColor: 0x123456,
        });
        expect(payload && typeof payload === 'object').toBe(true);
        const embeds = (payload as any).embeds as Array<Record<string, unknown>>;
        expect(Array.isArray(embeds)).toBe(true);
        expect(embeds.length).toBe(1);
        const e = embeds[0] as Record<string, unknown>;
        expect(e.title).toBe('Patch 1.2');
        expect(typeof e.description).toBe('string');
        expect((e.description as string).length).toBe(350);
        expect(e.url).toBe('https://example.com/patch');
        expect(e.author && (e.author as any).name).toBe('Test Game');
        expect(e.color).toBe(0x123456);
        expect((e as any).thumbnail && (e as any).thumbnail.url).toBe('https://example.com/logo.png');
        expect((e as any).image && (e as any).image.url).toBe('https://example.com/image.png');
    });
});
