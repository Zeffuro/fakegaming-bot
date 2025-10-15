// Use Web Crypto API for CSPRNG to be compatible with both browser and Node 18+/20+ environments.
// Avoid importing Node's crypto directly so this module can be safely bundled for the browser.

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
 * Convert a byte array to a lowercase hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i]!
            .toString(16)
            .padStart(2, '0');
        hex += b;
    }
    return hex;
}

/**
 * Generate a random CSRF token (hex string).
 */
export function generateCsrfToken(): string {
    const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
        throw new Error('Secure random generator not available (crypto.getRandomValues missing)');
    }
    const buf = new Uint8Array(32);
    cryptoObj.getRandomValues(buf);
    return bytesToHex(buf);
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
