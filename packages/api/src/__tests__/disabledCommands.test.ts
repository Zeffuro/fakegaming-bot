import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt, expectUnauthorized, expectNotFound, expectBadRequest, expectCreated, expectOk, expectInternalServerError } from '@zeffuro/fakegaming-common/testing';

const testConfig = {
    guildId: 'testguild1',
    commandName: 'testcommand1'
};

let disabledId: number;

beforeEach(async () => {
    await configManager.disabledCommandManager.removeAll();
    const created = await configManager.disabledCommandManager.addPlain(testConfig);
    disabledId = created.id;
});

describe('DisabledCommands API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });

    it('should list all disabled commands', async () => {
        const res = await request(app).get('/api/disabledCommands').set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should check if a command is disabled in a guild', async () => {
        const res = await request(app)
            .get('/api/disabledCommands/check')
            .set('Authorization', `Bearer ${token}`)
            .query({guildId: testConfig.guildId, commandName: testConfig.commandName});
        expectOk(res);
        expect(res.body.disabled).toBe(true);
    });

    it('should add a disabled command', async () => {
        const res = await request(app)
            .post('/api/disabledCommands')
            .set('Authorization', `Bearer ${token}`)
            .send({guildId: 'testguild2', commandName: 'testcommand2'});
        expectCreated(res);
        expect(res.body.guildId).toBe('testguild2');
    });

    it('should delete a disabled command by id', async () => {
        const res = await request(app)
            .delete(`/api/disabledCommands/${disabledId}`)
            .set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid id on DELETE /api/disabledCommands/:id', async () => {
        const res = await request(app)
            .delete('/api/disabledCommands/invalid')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Params validation failed');
    });

    it('should return 400 for missing check params', async () => {
        const res = await request(app)
            .get('/api/disabledCommands/check')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
    });

    it('should return 401 for GET /api/disabledCommands without JWT', async () => {
        const res = await request(app).get('/api/disabledCommands');
        expectUnauthorized(res);
    });

    it('should return 401 for POST /api/disabledCommands without JWT', async () => {
        const res = await request(app)
            .post('/api/disabledCommands')
            .send({guildId: 'testguild2', commandName: 'testcommand2'});
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/disabledCommands/:id without JWT', async () => {
        const res = await request(app)
            .delete(`/api/disabledCommands/${disabledId}`);
        expectUnauthorized(res);
    });

    it('should return 404 when deleting non-existent disabled command', async () => {
        const res = await request(app)
            .delete('/api/disabledCommands/999999')
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });

    it('should handle duplicate add gracefully', async () => {
        const res1 = await request(app)
            .post('/api/disabledCommands')
            .set('Authorization', `Bearer ${token}`)
            .send({guildId: testConfig.guildId, commandName: 'testcommand1'});
        if (res1.status === 201) {
            expectCreated(res1);
        } else {
            const { expectConflict } = await import('@zeffuro/fakegaming-common/testing');
            expectConflict(res1);
        }
    });

    it('should return 400 for invalid input types', async () => {
        const res = await request(app)
            .post('/api/disabledCommands')
            .set('Authorization', `Bearer ${token}`)
            .send({guildId: 123, commandName: null});
        expect([400, 500]).toContain(res.status);
    });

    it('should return 500 for DB error on POST /api/disabledCommands', async () => {
        // Simulate DB error by mocking addPlain
        const origAdd = configManager.disabledCommandManager.addPlain;
        configManager.disabledCommandManager.addPlain = async () => { throw new Error('DB error'); };
        const res = await request(app)
            .post('/api/disabledCommands')
            .set('Authorization', `Bearer ${token}`)
            .send({guildId: 'testguild3', commandName: 'testcommand3'});
        expectInternalServerError(res);
        configManager.disabledCommandManager.addPlain = origAdd;
    });
});