import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../serviceAuth.js', () => ({ isServiceRequest: vi.fn().mockReturnValue(true) }));

import { getJwtSecret, jwtOrService } from '../auth.js';

const ORIGINAL_ENV = { ...process.env };

describe('middleware/auth', () => {
    beforeEach(() => { process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' }; });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

    it('getJwtSecret returns fallback in test env', () => {
        delete process.env.JWT_SECRET;
        expect(getJwtSecret()).toBe('testsecret');
    });

    it('jwtOrService bypasses when isServiceRequest is true', () => {
        const req: any = {};
        const res: any = {};
        const next = vi.fn();
        jwtOrService(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getJwtSecret throws when missing outside test env', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        expect(() => getJwtSecret()).toThrowError(/Missing required environment variable/);
    });
});

