import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import {
    expectBadRequest,
    expectCreated,
    expectNotFound,
    expectOk,
    expectUnauthorized,
    signTestJwt
} from '@zeffuro/fakegaming-common/testing';

const testConfig = {
    guildId: 'testguild1',
    moduleName: 'twitch'
};

let disabledModuleId: number;

beforeEach(async () => {
    await configManager.disabledModuleManager.removeAll();
    const created = await configManager.disabledModuleManager.addPlain(testConfig);
    disabledModuleId = created.id;
});

describe('DisabledModules API', () => {
    let token: string;

    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });

    it('should list all disabled modules and filter by guild', async () => {
        const all = await request(app)
            .get('/api/disabledModules')
            .set('Authorization', `Bearer ${token}`);
        expectOk(all);
        expect(Array.isArray(all.body)).toBe(true);

        const filtered = await request(app)
            .get('/api/disabledModules')
            .set('Authorization', `Bearer ${token}`)
            .query({ guildId: testConfig.guildId });
        expectOk(filtered);
        expect(filtered.body).toEqual(expect.arrayContaining([
            expect.objectContaining(testConfig)
        ]));
    });

    it('should check if a module is disabled', async () => {
        const res = await request(app)
            .get('/api/disabledModules/check')
            .set('Authorization', `Bearer ${token}`)
            .query(testConfig);

        expectOk(res);
        expect(res.body).toEqual({ disabled: true });
    });

    it('should return false for an enabled module', async () => {
        const res = await request(app)
            .get('/api/disabledModules/check')
            .set('Authorization', `Bearer ${token}`)
            .query({ guildId: testConfig.guildId, moduleName: 'quotes' });

        expectOk(res);
        expect(res.body).toEqual({ disabled: false });
    });

    it('should require auth and valid query for check', async () => {
        const unauthenticated = await request(app)
            .get('/api/disabledModules/check')
            .query(testConfig);
        expectUnauthorized(unauthenticated);

        const invalidQuery = await request(app)
            .get('/api/disabledModules/check')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(invalidQuery);
    });

    it('should get a disabled module by id and return 404 when missing', async () => {
        const found = await request(app)
            .get(`/api/disabledModules/${disabledModuleId}`)
            .set('Authorization', `Bearer ${token}`);
        expectOk(found);
        expect(found.body).toMatchObject(testConfig);

        const missing = await request(app)
            .get('/api/disabledModules/999999')
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(missing);
    });

    it('should return 400 for invalid disabled module id', async () => {
        const res = await request(app)
            .get('/api/disabledModules/invalid')
            .set('Authorization', `Bearer ${token}`);

        expectBadRequest(res);
    });

    it('should create a disabled module', async () => {
        const res = await request(app)
            .post('/api/disabledModules')
            .set('Authorization', `Bearer ${token}`)
            .send({ guildId: 'testguild2', moduleName: 'youtube' });

        expectCreated(res);
        expect(res.body).toMatchObject({ guildId: 'testguild2', moduleName: 'youtube' });
    });

    it('should require auth and valid body for create', async () => {
        const unauthenticated = await request(app)
            .post('/api/disabledModules')
            .send({ guildId: 'testguild2', moduleName: 'youtube' });
        expectUnauthorized(unauthenticated);

        const invalidBody = await request(app)
            .post('/api/disabledModules')
            .set('Authorization', `Bearer ${token}`)
            .send({ guildId: 123, moduleName: null });
        expectBadRequest(invalidBody);
    });

    it('should delete a disabled module by id', async () => {
        const res = await request(app)
            .delete(`/api/disabledModules/${disabledModuleId}`)
            .set('Authorization', `Bearer ${token}`);

        expectOk(res);
        expect(res.body).toEqual({ success: true });
    });

    it('should require auth and existing id for delete', async () => {
        const unauthenticated = await request(app).delete(`/api/disabledModules/${disabledModuleId}`);
        expectUnauthorized(unauthenticated);

        const missing = await request(app)
            .delete('/api/disabledModules/999999')
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(missing);

        const invalidId = await request(app)
            .delete('/api/disabledModules/invalid')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(invalidId);
    });
});
