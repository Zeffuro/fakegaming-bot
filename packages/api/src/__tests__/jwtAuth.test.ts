import { describe, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { signTestJwt, expectUnauthorized, expectCreated } from '@zeffuro/fakegaming-common/testing';
import jwt from 'jsonwebtoken';

describe('JWT Authentication', () => {
    it('should allow access with a valid JWT', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${token}`)
            .send({
                id: 'jwt-test-1',
                guildId: 'jwtguild',
                authorId: 'jwtauthor',
                submitterId: 'jwtsubmitter',
                quote: 'JWT test quote',
                timestamp: Date.now()
            });
        expectCreated(res);
    });

    it('should reject access with a missing JWT', async () => {
        const res = await request(app)
            .post('/api/quotes')
            .send({
                id: 'jwt-test-2',
                guildId: 'jwtguild',
                authorId: 'jwtauthor',
                submitterId: 'jwtsubmitter',
                quote: 'JWT test quote',
                timestamp: Date.now()
            });
        expectUnauthorized(res);
    });

    it('should reject access with an invalid JWT', async () => {
        const invalidToken = jwt.sign({foo: 'bar'}, 'wrongsecret', {algorithm: 'HS256'});
        const res = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${invalidToken}`)
            .send({
                id: 'jwt-test-3',
                guildId: 'jwtguild',
                authorId: 'jwtauthor',
                submitterId: 'jwtsubmitter',
                quote: 'JWT test quote',
                timestamp: Date.now()
            });
        expectUnauthorized(res);
    });
});
