process.env.ENABLE_RATE_LIMIT_TESTS = '1';
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit, limiter } from '../middleware/rateLimit.js';
import { jwtAuth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getSequelize } from '@zeffuro/fakegaming-common';

process.env.JWT_SECRET = 'testsecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming-test';
process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1s window for test
process.env.RATE_LIMIT_DEFAULT = '3'; // allow 3
process.env.DATABASE_PROVIDER = 'sqlite';

async function ensureTable() {
    const sequelize = getSequelize(true);
    await sequelize.query(`CREATE TABLE IF NOT EXISTS api_rate_limits (\n        key TEXT NOT NULL,\n        window_ts DATETIME NOT NULL,\n        count INTEGER NOT NULL DEFAULT 0,\n        PRIMARY KEY (key, window_ts)\n    );`);
}

function sign(discordId: string) {
    return jwt.sign({ discordId }, process.env.JWT_SECRET!, { audience: process.env.JWT_AUDIENCE, issuer: process.env.JWT_ISSUER });
}

describe('rateLimit middleware', () => {
    let app: express.Application;

    beforeEach(async () => {
        await ensureTable();
        app = express();
        app.use(express.json());
        app.use('/api', (req, res, next) => jwtAuth(req, res, next));
        app.use('/api', (req, res, next) => rateLimit(req, res, next));
        app.get('/api/test', (_req, res) => res.json({ ok: true }));
    });

    it('allows requests until limit then returns 429', async () => {
        const token = sign('u1');
        for (let i = 0; i < 3; i++) {
            const r = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
            expect(r.status).toBe(200);
        }
        const over = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        expect(over.status).toBe(429);
        expect(over.body.error.code).toBe('RATE_LIMIT');
        expect(over.headers['x-ratelimit-limit']).toBe('3');
        expect(over.headers['x-ratelimit-remaining']).toBe('0');
        expect(over.headers['retry-after']).toBeDefined();
    });

    it('separate users have isolated counters', async () => {
        const t1 = sign('uA');
        const t2 = sign('uB');
        for (let i = 0; i < 3; i++) {
            const r1 = await request(app).get('/api/test').set('Authorization', `Bearer ${t1}`);
            expect(r1.status).toBe(200);
        }
        // user A now blocked
        const blocked = await request(app).get('/api/test').set('Authorization', `Bearer ${t1}`);
        expect(blocked.status).toBe(429);
        // user B still allowed
        const r2 = await request(app).get('/api/test').set('Authorization', `Bearer ${t2}`);
        expect(r2.status).toBe(200);
    });

    it('fallback path engages when DB errors and enforces tiny bucket of 5', async () => {
        const token = sign('uF');
        const originalQuery = (limiter as any).sequelize.query;
        // Force errors
        (limiter as any).sequelize.query = async () => { throw new Error('forced db error'); };
        try {
            for (let i = 0; i < 5; i++) {
                const r = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
                expect(r.status).toBe(200);
                expect(r.headers['x-ratelimit-limit']).toBe('5');
            }
            const blocked = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
            expect(blocked.status).toBe(429);
            expect(blocked.headers['x-ratelimit-limit']).toBe('5');
        } finally {
            (limiter as any).sequelize.query = originalQuery;
        }
    });

    it('cleanup removes expired buckets', async () => {
        const sequelize = getSequelize(true);
        await ensureTable();
        const oldTs = new Date(Date.now() - 5000).toISOString();
        await sequelize.query('INSERT OR IGNORE INTO api_rate_limits (key, window_ts, count) VALUES (:key, :window_ts, 1)', { replacements: { key: 'user:old:route:GET:/api/test', window_ts: oldTs } });
        const deleted = await limiter.cleanup(1000); // retention 1s
        expect(deleted).toBeGreaterThanOrEqual(1);
        const [rows] = await sequelize.query('SELECT * FROM api_rate_limits WHERE key = :key', { replacements: { key: 'user:old:route:GET:/api/test' } });
        expect((rows as any[]).length).toBe(0);
    });

    it('includes rate limit headers on allowed responses', async () => {
        const token = sign('uHeaders');
        const r = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        expect(r.status).toBe(200);
        expect(r.headers['x-ratelimit-limit']).toBeDefined();
        expect(r.headers['x-ratelimit-remaining']).toBeDefined();
        expect(r.headers['x-ratelimit-reset']).toBeDefined();
    });
});
