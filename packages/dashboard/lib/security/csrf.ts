import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken, validateCsrf } from '@zeffuro/fakegaming-common/security';

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken, validateCsrf };

/**
 * Set the CSRF cookie (double-submit pattern). Not HttpOnly so the client can echo it via header.
 */
export function setCsrfCookie(res: NextResponse, token: string): void {
    res.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        // Rotate at login/refresh; keep a short lifetime
        maxAge: 30 * 60, // 30 minutes
    });
}

/**
 * Enforce CSRF validation on mutating requests.
 * Returns a 403 NextResponse on failure, or undefined when validation passes.
 */
export function enforceCsrf(req: NextRequest): NextResponse | undefined {
    const result = validateCsrf({
        method: req.method,
        headers: { get: (name: string) => req.headers.get(name) },
        cookies: { get: (name: string) => req.cookies.get(name) as any },
    });
    if (result.valid) return undefined;
    return NextResponse.json(
        { error: 'CSRF', details: result.error ?? 'Invalid CSRF token' },
        { status: 403 },
    );
}
