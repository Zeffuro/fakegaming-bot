process.env.ENABLE_CSRF_TESTS = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { enforceCsrf } from '../middleware/csrf.js';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@zeffuro/fakegaming-common/security';
import { expectOk, expectForbidden } from '@zeffuro/fakegaming-common/testing';

describe('CSRF middleware (Express adapter)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.post('/mutate', enforceCsrf, (req, res) => {
            res.json({ ok: true });
        });
        app.get('/read', (req, res) => res.json({ ok: true }));
    });

    it('allows safe (GET) without CSRF', async () => {
        const r = await request(app).get('/read');
        expectOk(r);
    });

    it('rejects mutating request without tokens', async () => {
        const r = await request(app).post('/mutate');
        expectForbidden(r);
        expect(r.body.error).toBe('CSRF');
    });

    it('rejects mutating request with mismatched tokens', async () => {
        const tokenCookie = generateCsrfToken();
        const tokenHeader = generateCsrfToken();
        const r = await request(app)
            .post('/mutate')
            .set('Cookie', `${CSRF_COOKIE_NAME}=${tokenCookie}`)
            .set(CSRF_HEADER_NAME, tokenHeader);
        expectForbidden(r);
    });

    it('accepts mutating request with valid tokens', async () => {
        // Use the helper only to ensure cookie attributes are reasonable; supertest only cares about header value
        const token = generateCsrfToken();
        // Set both header and cookie with the same token
        const r = await request(app)
            .post('/mutate')
            .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`)
            .set(CSRF_HEADER_NAME, token);
        expectOk(r);
        expect(r.body.ok).toBe(true);
    });
});
