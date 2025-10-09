import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../vitest.setup.js';

describe('PatchSubscriptions API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all patch subscriptions', async () => {
        const res = await request(app).get('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should subscribe to a game/channel', async () => {
        const res = await request(app).post('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`).send({
            game: 'patchsubgame2',
            channelId: 'patchsubchan2',
            guildId: 'testguild2'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('should upsert a patch subscription', async () => {
        const res = await request(app).put('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`).send({
            game: 'patchsubgame1',
            channelId: 'patchsubchan1',
            guildId: 'testguild1'
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 400 for GET /api/patchSubscriptions/:id with invalid id', async () => {
        const res = await request(app)
            .get('/api/patchSubscriptions/abc')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Params validation failed');
    });

    it('should return 400 when POST /api/patchSubscriptions with missing fields', async () => {
        const res = await request(app)
            .post('/api/patchSubscriptions')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });

    it('should return 401 for DELETE /api/patchSubscriptions/:id without JWT', async () => {
        const res = await request(app)
            .delete('/api/patchSubscriptions/1');
        expect(res.status).toBe(401);
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
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent patch subscription', async () => {
        const res = await request(app)
            .delete('/api/patchSubscriptions/999999')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id on DELETE /api/patchSubscriptions/:id', async () => {
        const res = await request(app)
            .delete('/api/patchSubscriptions/invalid')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Params validation failed');
    });
});
