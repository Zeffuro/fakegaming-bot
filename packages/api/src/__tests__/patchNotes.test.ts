import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

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
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all patch notes', async () => {
        const res = await request(app).get('/api/patchNotes').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get the latest patch note for a game', async () => {
        const res = await request(app).get(`/api/patchNotes/${testPatch.game}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.game).toBe(testPatch.game);
        expect(res.body.title).toBe(testPatch.title);
    });
    it('should upsert (add/update) a patch note', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/patchNotes').set('Authorization', `Bearer ${token}`).send({
            game: testPatch.game, // Use the same game as the initial patch
            title: 'Major update',
            content: 'Major update notes',
            url: 'https://example.com/patch/2',
            publishedAt: now + 1,
            version: '2.0.0'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
    it('should return 404 for non-existent patch note', async () => {
        const res = await request(app).get('/api/patchNotes/nonexistentgame').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});
