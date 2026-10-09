import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { enforceCsrf } from '@/lib/security/csrf';
import { authenticateUser } from '@/lib/auth/authUtils';
import { CALENDAR_BROWSER_COOKIE, CALENDAR_STATE_COOKIE, calendarCookieOptions, calendarOAuthError, callCalendarOAuthApi } from '@/lib/auth/googleCalendarOAuth';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
    const failed = enforceCsrf(req);
    if (failed) return failed;
    if (!(await authenticateUser(req)).success) return calendarOAuthError(req, 401);
    try {
        const browserBinding = randomBytes(32).toString('base64url');
        const upstream = await callCalendarOAuthApi(req, 'connect', { browserBinding });
        if (!upstream.ok) return calendarOAuthError(req, upstream.status);
        const result: unknown = await upstream.json();
        if (!result || typeof result !== 'object' || !('url' in result) || typeof result.url !== 'string'
            || !('state' in result) || typeof result.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.state)) return calendarOAuthError(req, 502);
        const url = new URL(result.url);
        if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') return calendarOAuthError(req, 502);
        const response = NextResponse.json({ url: url.href });
        response.cookies.set(CALENDAR_STATE_COOKIE, result.state, calendarCookieOptions);
        response.cookies.set(CALENDAR_BROWSER_COOKIE, browserBinding, calendarCookieOptions);
        return response;
    } catch { return calendarOAuthError(req, 502); }
}
