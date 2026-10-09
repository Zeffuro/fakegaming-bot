import type { NextRequest } from 'next/server';
import { authenticateUser } from '@/lib/auth/authUtils';
import { CALENDAR_BROWSER_COOKIE, CALENDAR_STATE_COOKIE, calendarOAuthRedirect, callCalendarOAuthApi } from '@/lib/auth/googleCalendarOAuth';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
    const state = req.nextUrl.searchParams.get('state');
    const code = req.nextUrl.searchParams.get('code');
    const browserBinding = req.cookies.get(CALENDAR_BROWSER_COOKIE)?.value;
    if (!state || !code || !browserBinding || state !== req.cookies.get(CALENDAR_STATE_COOKIE)?.value || req.nextUrl.searchParams.has('error')) return calendarOAuthRedirect('error');
    try {
        if (!(await authenticateUser(req)).success) return calendarOAuthRedirect('error');
        const upstream = await callCalendarOAuthApi(req, 'complete', { code, state, browserBinding });
        if (!upstream.ok) return calendarOAuthRedirect('error');
        const result: unknown = await upstream.json();
        return calendarOAuthRedirect(result && typeof result === 'object' && 'success' in result && result.success === true ? 'success' : 'error');
    } catch { return calendarOAuthRedirect('error'); }
}
