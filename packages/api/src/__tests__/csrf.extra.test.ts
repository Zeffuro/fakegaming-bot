process.env.ENABLE_CSRF_TESTS = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { enforceCsrf, enforceCsrfOnce, skipCsrf, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../middleware/csrf.js';
import { generateCsrfToken } from '@zeffuro/fakegaming-common/security';

describe('CSRF middleware extra branches', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Route that explicitly skips CSRF (e.g., login)
        app.post('/login', (req, res, next) => skipCsrf(req, res, next), (req, res, next) => enforceCsrf(req, res, next), (_req, res) => {
            res.json({ ok: true });
        });

        // Route that runs enforceCsrf then enforceCsrfOnce (short-circuit path)
        app.post('/twice', (req, res, next) => enforceCsrf(req, res, next), (req, res, next) => enforceCsrfOnce(req, res, next), (_req, res) => {
            res.json({ ok: true });
        });

        // Route to exercise parseCookies decodeURIComponent error path
        app.post('/malformed', (req, res, next) => enforceCsrf(req, res, next), (_req, res) => {
            res.json({ ok: true });
        });
    });

    it('allows POST when CSRF is explicitly skipped', async () => {
        const r = await request(app).post('/login');
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
    });

    it('short-circuits in enforceCsrfOnce when already validated by enforceCsrf', async () => {
        const token = generateCsrfToken();
        const r = await request(app)
            .post('/twice')
            .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`)
            .set(CSRF_HEADER_NAME, token);
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
    });

    it('handles malformed cookie value via parseCookies fallback and rejects with 403', async () => {
        // Invalid percent-encoding ensures decodeURIComponent throws and fallback path is used
        const malformed = 'abc%ZZ';
        const r = await request(app)
            .post('/malformed')
            .set('Cookie', `${CSRF_COOKIE_NAME}=${malformed}`)
            .set(CSRF_HEADER_NAME, 'different');
        expect(r.status).toBe(403);
        expect(r.body.error).toBe('CSRF');
    });
});

