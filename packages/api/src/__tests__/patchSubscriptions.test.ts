import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt, expectUnauthorized, expectNotFound, expectBadRequest, expectCreated, expectOk } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../vitest.setup.js';

describe('PatchSubscriptions API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all patch subscriptions', async () => {
        const res = await request(app).get('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should subscribe to a game/channel', async () => {
        const res = await request(app).post('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`).send({
            game: 'patchsubgame2',
            channelId: 'patchsubchan2',
            guildId: 'testguild2'
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });

    it('should upsert a patch subscription', async () => {
        const res = await request(app).put('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`).send({
            game: 'patchsubgame1',
            channelId: 'patchsubchan1',
            guildId: 'testguild1'
        });
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should return 400 for GET /api/patchSubscriptions/:id with invalid id', async () => {
        const res = await request(app)
            .get('/api/patchSubscriptions/abc')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Params validation failed');
    });

    it('should return 400 when POST /api/patchSubscriptions with missing fields', async () => {
        const res = await request(app)
            .post('/api/patchSubscriptions')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('should return 400 when PUT /api/patchSubscriptions with missing fields', async () => {
        const res = await request(app)
            .put('/api/patchSubscriptions')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('should return 401 for POST /api/patchSubscriptions without JWT', async () => {
        const res = await request(app)
            .post('/api/patchSubscriptions')
            .send({ game: 'g', channelId: 'c', guildId: 'guild' });
        expectUnauthorized(res);
    });

    it('should return 401 for PUT /api/patchSubscriptions without JWT', async () => {
        const res = await request(app)
            .put('/api/patchSubscriptions')
            .send({ game: 'g', channelId: 'c', guildId: 'guild' });
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/patchSubscriptions/:id without JWT', async () => {
        const res = await request(app)
            .delete('/api/patchSubscriptions/1');
        expectUnauthorized(res);
    });

    it('should delete a patch subscription by id', async () => {
        // create one to delete
        const created = await configManager.patchSubscriptionManager.addPlain({
            game: 'deletable-game',
            channelId: 'chan-del',
            guildId: 'guild-del'
        });
        const res = await request(app)
            .delete(`/api/patchSubscriptions/${created.id}`)
            .set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent patch subscription', async () => {
        const res = await request(app)
            .delete('/api/patchSubscriptions/999999')
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });

    it('should return 400 for invalid id on DELETE /api/patchSubscriptions/:id', async () => {
        const res = await request(app)
            .delete('/api/patchSubscriptions/invalid')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Params validation failed');
    });
});
