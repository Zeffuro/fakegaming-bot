import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { API_URL, PUBLIC_URL } from '@/lib/env';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@zeffuro/fakegaming-common/security';
import { getRequestDashboardLocaleFromRequest, getRequestDashboardMessageFromRequest } from '@/lib/i18n/server';

export const CALENDAR_STATE_COOKIE = 'fg.calendar.state';
export const CALENDAR_BROWSER_COOKIE = 'fg.calendar.browser';
export const calendarCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/auth/google-calendar', maxAge: 600 };

export async function callCalendarOAuthApi(req: NextRequest, action: 'connect' | 'complete', body: unknown): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${req.cookies.get('jwt')?.value ?? ''}`, 'Accept-Language': getRequestDashboardLocaleFromRequest(req) };
    const csrf = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (csrf) { headers[CSRF_HEADER_NAME] = csrf; headers.Cookie = `${CSRF_COOKIE_NAME}=${csrf}`; }
    return fetch(`${API_URL}/userCalendar/${action}`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15_000) });
}

export function calendarOAuthError(req: NextRequest, status: number) {
    return NextResponse.json({ error: getRequestDashboardMessageFromRequest(req, status === 401 ? 'error.notAuthenticated' : 'calendar.connectionError') }, { status });
}

export function calendarOAuthRedirect(result: 'success' | 'error') {
    const url = new URL('/dashboard/me', PUBLIC_URL);
    url.searchParams.set('googleCalendar', result);
    const response = NextResponse.redirect(url);
    response.cookies.set(CALENDAR_STATE_COOKIE, '', { ...calendarCookieOptions, maxAge: 0 });
    response.cookies.set(CALENDAR_BROWSER_COOKIE, '', { ...calendarCookieOptions, maxAge: 0 });
    return response;
}
