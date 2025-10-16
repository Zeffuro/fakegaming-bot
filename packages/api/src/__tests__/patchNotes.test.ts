import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectCreated, expectUnauthorized, expectBadRequest, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const now = Date.now();
const testPatch = {
    game: 'testgame1',
    title: 'Initial release',
    content: 'Initial patch notes',
    url: 'https://example.com/patch/1',
    publishedAt: now,
    version: '1.0.0'
};

beforeEach(async () => {
    await configManager.patchNotesManager.removeAll();
    await configManager.patchNotesManager.setLatestPatch(testPatch);
});

describe('PatchNotes API', () => {
    const client = givenAuthenticatedClient(app);

    it('should list all patch notes', async () => {
        const res = await client.get('/api/patchNotes');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get the latest patch note for a game', async () => {
        const res = await client.get(`/api/patchNotes/${testPatch.game}`);
        expectOk(res);
        expect(res.body.game).toBe(testPatch.game);
        expect(res.body.title).toBe(testPatch.title);
    });
    it('should upsert (add/update) a patch note', async () => {
        const res = await client.post('/api/patchNotes', {
            game: testPatch.game, // Use the same game as the initial patch
            title: 'Major update',
            content: 'Major update notes',
            url: 'https://example.com/patch/2',
            publishedAt: now + 1,
            version: '2.0.0'
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });
    it('should return 404 for non-existent patch note', async () => {
        const res = await client.get('/api/patchNotes/nonexistentgame');
        expectNotFound(res);
    });
    it('should return 400 when POST /api/patchNotes with missing fields', async () => {
        const res = await client.post('/api/patchNotes', {} as any);
        expectBadRequest(res);
        expect(typeof res.body.error.message).toBe('string');
    });

    it('should return 401 for POST /api/patchNotes without JWT', async () => {
        const res = await client.raw
            .post('/api/patchNotes')
            .send({ game: 'g', title: 't', content: 'c', url: 'u', publishedAt: Date.now(), version: 'v' });
        expectUnauthorized(res);
    });

    it('should list supported games', async () => {
        const res = await client.get('/api/patchNotes/supportedGames');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
        // Should contain at least one common title
        expect(res.body.length).toBeGreaterThan(0);
    });
});
