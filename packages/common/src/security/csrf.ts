import { randomBytes } from 'node:crypto';

export const CSRF_COOKIE_NAME = 'csrf' as const;
export const CSRF_HEADER_NAME = 'x-csrf-token' as const;

function isMutatingMethod(method: string): boolean {
    const m = method.toUpperCase();
    return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

export interface ReqHeadersLike {
    get(name: string): string | null;
}

export interface ReqCookiesLike {
    get(name: string): { value: string } | undefined;
}

export interface ReqLike {
    method?: string;
    headers: ReqHeadersLike;
    cookies: ReqCookiesLike;
}

/**
 * Generate a random CSRF token (hex string).
 */
export function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Validate CSRF tokens for a request. Returns { valid, error? }.
 * - Safe methods (GET/HEAD/OPTIONS) are considered valid.
 */
export function validateCsrf(req: ReqLike): { valid: boolean; error?: string } {
    const method = (req.method || 'GET').toUpperCase();
    if (!isMutatingMethod(method)) return { valid: true };
    if (method === 'OPTIONS') return { valid: true };

    const headerToken = req.headers.get(CSRF_HEADER_NAME) || '';
    const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value || '';

    if (!cookieToken || !headerToken) {
        return { valid: false, error: 'Missing CSRF token' };
    }
    if (cookieToken !== headerToken) {
        return { valid: false, error: 'Invalid CSRF token' };
    }

    return { valid: true };
}

