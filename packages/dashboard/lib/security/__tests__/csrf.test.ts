import { describe, it, expect } from 'vitest';
import { generateCsrfToken, validateCsrf, enforceCsrf } from '@/lib/security/csrf.js';
import { expectForbidden } from '@zeffuro/fakegaming-common/testing';

function mockReq(opts: { method?: string; cookieToken?: string; headerToken?: string }) {
    const { method = 'POST', cookieToken, headerToken } = opts;
    return {
        method,
        cookies: { get: (name: string) => name === 'csrf' && cookieToken ? { value: cookieToken } : undefined },
        headers: {
            get: (name: string) => name.toLowerCase() === 'x-csrf-token' && headerToken ? headerToken : null
        }
    } as any; // NextRequest minimal mock
}

describe('csrf utilities', () => {
    it('generateCsrfToken returns 64 hex chars', () => {
        const token = generateCsrfToken();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('validateCsrf passes safe GET without tokens', () => {
        const res = validateCsrf(mockReq({ method: 'GET' }));
        expect(res.valid).toBe(true);
    });

    it('validateCsrf fails when missing tokens on POST', () => {
        const res = validateCsrf(mockReq({ method: 'POST' }));
        expect(res.valid).toBe(false);
        expect(res.error).toBe('Missing CSRF token');
    });

    it('validateCsrf fails when mismatch', () => {
        const res = validateCsrf(mockReq({ method: 'POST', cookieToken: 'abc', headerToken: 'def' }));
        expect(res.valid).toBe(false);
        expect(res.error).toBe('Invalid CSRF token');
    });

    it('validateCsrf succeeds when tokens match', () => {
        const res = validateCsrf(mockReq({ method: 'POST', cookieToken: 't', headerToken: 't' }));
        expect(res.valid).toBe(true);
    });

    it('enforceCsrf returns response on failure', () => {
        const failResp = enforceCsrf(mockReq({ method: 'POST' }));
        expectForbidden(failResp as any);
    });

    it('enforceCsrf undefined on success', () => {
        const ok = enforceCsrf(mockReq({ method: 'POST', cookieToken: 'x', headerToken: 'x' }));
        expect(ok).toBeUndefined();
    });
});
