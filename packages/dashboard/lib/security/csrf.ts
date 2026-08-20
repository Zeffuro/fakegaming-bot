import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken, validateCsrf } from '@zeffuro/fakegaming-common/security';
import { REFRESH_SESSION_IDLE_MAX_AGE_SECONDS } from '@/lib/auth/sessionConstants';
import { getRequestDashboardMessageFromRequest } from '@/lib/i18n/server';

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
        maxAge: REFRESH_SESSION_IDLE_MAX_AGE_SECONDS,
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
        cookies: { get: (name: string) => req.cookies.get(name) },
    });
    if (result.valid) return undefined;
    const hasCookieToken = Boolean(req.cookies.get(CSRF_COOKIE_NAME)?.value);
    const hasHeaderToken = Boolean(req.headers.get(CSRF_HEADER_NAME));
    const detailKey = hasCookieToken && hasHeaderToken ? 'error.csrfInvalid' : 'error.csrfMissing';
    return NextResponse.json(
        {
            error: 'CSRF',
            details: getRequestDashboardMessageFromRequest(req, detailKey),
        },
        { status: 403 },
    );
}
