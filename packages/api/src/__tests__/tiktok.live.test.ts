import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectOk, expectUnauthorized, expectBadRequest } from '@zeffuro/fakegaming-common/testing';

const client = givenAuthenticatedClient(app);

// Mock the connector module once; we'll set its implementation per-test in beforeEach
vi.mock('tiktok-live-connector', () => ({
    TikTokLiveConnection: vi.fn()
}));

describe('GET /api/tiktok/live', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { TikTokLiveConnection } = await import('tiktok-live-connector');
        (TikTokLiveConnection as any).mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue({ roomInfo: { room: { id: 'RID', title: 'Title', create_time: Math.floor((Date.now()-60000)/1000), user_count: 5, background_image: 'img' } } }),
            disconnect: vi.fn().mockResolvedValue(undefined)
        }));
    });
    afterEach(() => { vi.clearAllMocks(); });

    it('requires auth', async () => {
        const res = await client.raw.get('/api/tiktok/live').query({ username: 'x' });
        expectUnauthorized(res);
    });

    it('validates query', async () => {
        const res = await client.get('/api/tiktok/live');
        expectBadRequest(res);
    });

    it('returns minimal payload in light mode with debug', async () => {
        const res = await client.get('/api/tiktok/live').query({ username: 'creator', mode: 'light', debug: true });
        expectOk(res);
        expect(res.body).toHaveProperty('live');
        expect(res.body).toHaveProperty('debugMeta');
    });

    it('returns enriched payload in default mode without debug', async () => {
        const res = await client.get('/api/tiktok/live').query({ username: 'creator' });
        expectOk(res);
        expect(res.body).toMatchObject({ live: true, roomId: 'RID' });
        expect('debugMeta' in res.body).toBe(false);
    });

    it('handles offline case', async () => {
        const { TikTokLiveConnection } = await import('tiktok-live-connector');
        (TikTokLiveConnection as any).mockImplementation(() => ({
            connect: vi.fn().mockRejectedValue(new Error('offline')),
            disconnect: vi.fn().mockResolvedValue(undefined)
        }));
        const res = await client.get('/api/tiktok/live').query({ username: 'creator', debug: true });
        expectOk(res);
        expect(res.body.live).toBe(false);
        expect(res.body).toHaveProperty('debugMeta');
    });
});
