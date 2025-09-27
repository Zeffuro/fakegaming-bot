import request from 'supertest';
import app from '../app.js';
import {signTestJwt} from '../testUtils/jwt.js';

describe('PatchSubscriptions API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt();
    });
    it('should list all patch subscriptions', async () => {
        const res = await request(app).get('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should subscribe to a game/channel', async () => {
        const res = await request(app).post('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`).send({
            game: 'patchsubgame2',
            channelId: 'patchsubchan2'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('should upsert a patch subscription', async () => {
        const res = await request(app).put('/api/patchSubscriptions').set('Authorization', `Bearer ${token}`).send({
            game: 'patchsubgame1',
            channelId: 'patchsubchan1'
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
