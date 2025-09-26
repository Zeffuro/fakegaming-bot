import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';

const testPatch = {
    game: 'testgame1',
    version: '1.0.0',
    notes: 'Initial release'
};

beforeEach(async () => {
    // Clean up patch notes table before each test
    await configManager.patchNotesManager.forceTruncate();
    // Debug: print table schema and indexes
    const sequelize = configManager.patchNotesManager.getSequelize();
    if (sequelize) {
        const [schema] = await sequelize.query('PRAGMA table_info(PatchNoteConfigs);');
        const [indexes] = await sequelize.query('PRAGMA index_list(PatchNoteConfigs);');
        console.log('PatchNoteConfigs schema:', schema);
        console.log('PatchNoteConfigs indexes:', indexes);
    }
    const all = await configManager.patchNotesManager.getAll();
    console.log('Rows after cleanup:', all);
    await configManager.patchNotesManager.setLatestPatch(testPatch);
});

describe('PatchNotes API', () => {
    it('should list all patch notes', async () => {
        const res = await request(app).get('/api/patchNotes');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get the latest patch note for a game', async () => {
        const res = await request(app).get(`/api/patchNotes/${testPatch.game}`);
        expect(res.status).toBe(200);
        expect(res.body.game).toBe(testPatch.game);
    });

    it('should upsert (add/update) a patch note', async () => {
        const res = await request(app).post('/api/patchNotes').send({
            game: testPatch.game, // Use the same game as the initial patch
            version: '2.0.0',
            notes: 'Major update'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent patch note', async () => {
        const res = await request(app).get('/api/patchNotes/nonexistentgame');
        expect(res.status).toBe(404);
    });
});
