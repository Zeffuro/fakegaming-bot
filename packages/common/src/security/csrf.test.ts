// filepath: f:\Coding\discord-bot\packages\common\src\security\csrf.test.ts
import { describe, it, expect } from 'vitest';
import { generateCsrfToken, validateCsrf, CSRF_COOKIE_NAME, CSRF_HEADER_NAME, type ReqLike } from './csrf.js';

function makeReq(method: string, headerToken?: string, cookieToken?: string): ReqLike {
    return {
        method,
        headers: {
            get: (name: string) => (name.toLowerCase() === CSRF_HEADER_NAME ? headerToken ?? null : null),
        },
        cookies: {
            get: (name: string) => (name === CSRF_COOKIE_NAME && cookieToken ? { value: cookieToken } : undefined),
        },
    };
}

describe('CSRF utilities', () => {
    it('generateCsrfToken returns a 64-char hex string', () => {
        const token = generateCsrfToken();
        expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('validateCsrf allows safe methods', () => {
        const res = validateCsrf(makeReq('GET'));
        expect(res.valid).toBe(true);
    });

    it('validateCsrf rejects missing tokens on mutating methods', () => {
        const res = validateCsrf(makeReq('POST'));
        expect(res.valid).toBe(false);
        expect(res.error).toBeDefined();
    });

    it('validateCsrf accepts matching header and cookie on mutating methods', () => {
        const token = generateCsrfToken();
        const res = validateCsrf(makeReq('POST', token, token));
        expect(res.valid).toBe(true);
    });

    it('validateCsrf rejects mismatched tokens', () => {
        const res = validateCsrf(makeReq('POST', generateCsrfToken(), generateCsrfToken()));
        expect(res.valid).toBe(false);
    });
});

