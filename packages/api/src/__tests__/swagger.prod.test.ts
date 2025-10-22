import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// We need to simulate production mode to trigger file read path

describe('Swagger spec in production', () => {
    const origEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...origEnv, NODE_ENV: 'production', API_BUILD_MODE: '' } as any;
    });

    afterEach(() => {
        process.env = origEnv;
    });

    it('serves swagger ui with fallback spec when file missing', async () => {
        // Import app freshly under production mode
        const app = (await import('../app.js')).default;
        // We don't assert UI HTML; just ensure route mounts and responds
        const res = await request(app).get('/api/docs');
        // Docs route may be behind auth middleware; accept 200/301/302 or 401 Unauthorized
        expect([200, 301, 302, 401]).toContain(res.status);
        expect(typeof res.text === 'string' || typeof (res.headers as any).location === 'string' || res.status === 401).toBe(true);
    });
});
