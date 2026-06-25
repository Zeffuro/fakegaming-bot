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
    await configManager.patchNoteHistoryManager.removeAll();
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

    it('should list bounded patch note history with filters', async () => {
        await configManager.patchNoteHistoryManager.recordPatch({
            game: 'testgame1',
            title: 'Second release',
            content: 'Second patch notes content with enough words to preview',
            url: 'https://example.com/patch/2',
            publishedAt: now + 10_000,
            version: '2.0.0',
        });
        await configManager.patchNoteHistoryManager.recordPatch({
            game: 'othergame',
            title: 'Other release',
            content: 'Other patch notes',
            url: 'https://example.com/patch/other',
            publishedAt: now + 20_000,
            version: '1.1.0',
        });

        const res = await client.get(`/api/patchNotes/history?game=testgame1&q=Second&limit=1`);

        expectOk(res);
        expect(res.body.total).toBe(1);
        expect(res.body.limit).toBe(1);
        expect(res.body.items).toEqual([
            expect.objectContaining({
                contentBytes: expect.any(Number),
                contentPreview: 'Second patch notes content with enough words to preview',
                game: 'testgame1',
                title: 'Second release',
                version: '2.0.0',
            }),
        ]);
        expect(res.body.items[0]).not.toHaveProperty('content');
    });

    it('should compare two patch note history records on demand', async () => {
        await configManager.patchNoteHistoryManager.recordPatch({
            game: 'testgame1',
            title: 'Second release',
            content: [
                'Initial patch notes',
                'Added ranked changes',
            ].join('\n'),
            url: 'https://example.com/patch/2',
            publishedAt: now + 10_000,
            version: '2.0.0',
        });
        const history = await configManager.patchNoteHistoryManager.listHistory({ game: 'testgame1', limit: 10 });
        const older = history.items.find(item => item.title === 'Initial release');
        const newer = history.items.find(item => item.title === 'Second release');
        expect(older).toBeDefined();
        expect(newer).toBeDefined();
        if (!older || !newer) throw new Error('Expected seeded patch history records');

        const res = await client.get(`/api/patchNotes/history/compare?leftId=${older.id}&rightId=${newer.id}`);

        expectOk(res);
        expect(res.body.left).toEqual(expect.objectContaining({
            game: 'testgame1',
            title: 'Initial release',
        }));
        expect(res.body.right).toEqual(expect.objectContaining({
            title: 'Second release',
            version: '2.0.0',
        }));
        expect(res.body.summary.addedLines).toBe(1);
        expect(res.body.diff).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'added', text: 'Added ranked changes' }),
        ]));
        expect(res.body.left).not.toHaveProperty('content');
    });

    it('should reject patch note history compare across games', async () => {
        await configManager.patchNoteHistoryManager.recordPatch({
            game: 'othergame',
            title: 'Other release',
            content: 'Other patch notes',
            url: 'https://example.com/patch/other',
            publishedAt: now + 20_000,
            version: '1.1.0',
        });
        const history = await configManager.patchNoteHistoryManager.listHistory({ limit: 10 });
        const testGameRecord = history.items.find(item => item.game === 'testgame1');
        const otherGameRecord = history.items.find(item => item.game === 'othergame');
        expect(testGameRecord).toBeDefined();
        expect(otherGameRecord).toBeDefined();
        if (!testGameRecord || !otherGameRecord) throw new Error('Expected cross-game patch history records');

        const res = await client.get(`/api/patchNotes/history/compare?leftId=${testGameRecord.id}&rightId=${otherGameRecord.id}`);

        expectBadRequest(res);
    });
});
