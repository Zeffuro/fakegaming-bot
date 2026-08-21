import { formatDashboardMessage, type DashboardMessageKey } from "./messages";
import {
    DASHBOARD_LOCALE_COOKIE_KEY,
    getDashboardLocaleFromAcceptLanguage,
    isDashboardLocale,
} from "./localeStore";

interface DashboardLocaleRequest {
    headers: {
        get(name: string): string | null;
    };
    cookies: {
        get(name: string): { value: string } | undefined;
    };
}

export function getRequestDashboardLocale(
    acceptLanguage: string | null | undefined,
    preferredLocale?: string | null,
) {
    if (isDashboardLocale(preferredLocale)) return preferredLocale;
    return getDashboardLocaleFromAcceptLanguage(acceptLanguage);
}

export function getRequestDashboardMessage(
    acceptLanguage: string | null | undefined,
    key: DashboardMessageKey,
    preferredLocale?: string | null,
    values?: Record<string, string | number>,
): string {
    return formatDashboardMessage(
        getRequestDashboardLocale(acceptLanguage, preferredLocale),
        key,
        values,
    );
}

export function getRequestDashboardLocaleFromRequest(request: DashboardLocaleRequest) {
    return getRequestDashboardLocale(
        request.headers.get("accept-language"),
        request.cookies.get(DASHBOARD_LOCALE_COOKIE_KEY)?.value,
    );
}

export function getRequestDashboardMessageFromRequest(
    request: DashboardLocaleRequest,
    key: DashboardMessageKey,
    values?: Record<string, string | number>,
): string {
    return formatDashboardMessage(getRequestDashboardLocaleFromRequest(request), key, values);
}
