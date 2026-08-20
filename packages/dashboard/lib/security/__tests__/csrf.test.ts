import { describe, it, expect } from 'vitest';
import { generateCsrfToken, validateCsrf, enforceCsrf } from '@/lib/security/csrf.js';
import { expectForbidden } from '@zeffuro/fakegaming-common/testing';

function mockReq(opts: { method?: string; cookieToken?: string; headerToken?: string; acceptLanguage?: string; dashboardLocale?: string }) {
    const { method = 'POST', cookieToken, headerToken, acceptLanguage, dashboardLocale } = opts;
    return {
        method,
        cookies: {
            get: (name: string) => {
                if (name === 'csrf' && cookieToken) return { value: cookieToken };
                if (name === 'fg.dashboard.locale' && dashboardLocale) return { value: dashboardLocale };
                return undefined;
            },
        },
        headers: {
            get: (name: string) => {
                if (name.toLowerCase() === 'x-csrf-token') return headerToken ?? null;
                if (name.toLowerCase() === 'accept-language') return acceptLanguage ?? null;
                return null;
            },
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

    it('localizes CSRF failure details from Accept-Language', async () => {
        const failResp = enforceCsrf(mockReq({ method: 'POST', acceptLanguage: 'nl-NL,nl;q=0.9' }));
        const body = await failResp?.json();

        expect(body).toEqual({
            error: 'CSRF',
            details: 'Het beveiligingstoken ontbreekt. Vernieuw de pagina en probeer het opnieuw.',
        });
    });

    it('prefers the persisted dashboard locale for CSRF details', async () => {
        const failResp = enforceCsrf(mockReq({
            method: 'POST',
            acceptLanguage: 'en-US',
            dashboardLocale: 'nl',
        }));
        const body = await failResp?.json();

        expect(body.details).toBe('Het beveiligingstoken ontbreekt. Vernieuw de pagina en probeer het opnieuw.');
    });

    it('enforceCsrf undefined on success', () => {
        const ok = enforceCsrf(mockReq({ method: 'POST', cookieToken: 'x', headerToken: 'x' }));
        expect(ok).toBeUndefined();
    });
});
