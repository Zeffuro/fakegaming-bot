import {
    DEFAULT_LOCALE,
    LOCALE_METADATA,
    NON_DEFAULT_LOCALES,
    SUPPORTED_LOCALES,
    isSupportedLocale,
    resolveLocaleFromAcceptLanguage,
    type LocaleValues,
    type SupportedLocale,
} from "@zeffuro/fakegaming-common/output-locale";

export const DASHBOARD_LOCALE_STORAGE_KEY = "fg.dashboard.locale";
export const DASHBOARD_LOCALE_COOKIE_KEY = "fg.dashboard.locale";
export const DASHBOARD_DEFAULT_TIME_ZONE = "UTC";

export type DashboardLocale = SupportedLocale;
export type DashboardLocaleValues<T> = LocaleValues<T>;

export const dashboardLocales = SUPPORTED_LOCALES;
export const nonDefaultDashboardLocales = NON_DEFAULT_LOCALES;
export const dashboardLocaleMetadata = LOCALE_METADATA;
export const defaultDashboardLocale = DEFAULT_LOCALE;

type LocaleListener = (locale: DashboardLocale) => void;

let currentLocale: DashboardLocale = DEFAULT_LOCALE;
const listeners = new Set<LocaleListener>();

export function isDashboardLocale(value: unknown): value is DashboardLocale {
    return isSupportedLocale(value);
}

export function getDashboardLocaleFromAcceptLanguage(header: string | readonly string[] | null | undefined): DashboardLocale {
    return resolveLocaleFromAcceptLanguage(header);
}

export function getBrowserPreferredLocale(): DashboardLocale {
    if (typeof navigator === "undefined") return DEFAULT_LOCALE;

    const preferred = navigator.languages ?? [navigator.language];
    return getDashboardLocaleFromAcceptLanguage(preferred);
}

export function getDashboardIntlLocale(locale: DashboardLocale): string {
    return dashboardLocaleMetadata[locale].formatTag;
}

export function getStoredDashboardLocale(): DashboardLocale | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = window.localStorage.getItem(DASHBOARD_LOCALE_STORAGE_KEY);
        return isDashboardLocale(stored) ? stored : null;
    } catch {
        return null;
    }
}

export function getStoredDashboardCookieLocale(): DashboardLocale | null {
    if (typeof document === "undefined") return null;

    const prefix = `${DASHBOARD_LOCALE_COOKIE_KEY}=`;
    const rawValue = document.cookie
        .split(";")
        .map(part => part.trim())
        .find(part => part.startsWith(prefix))
        ?.slice(prefix.length);
    if (!rawValue) return null;

    try {
        const value = decodeURIComponent(rawValue);
        return isDashboardLocale(value) ? value : null;
    } catch {
        return null;
    }
}

export function getInitialDashboardLocale(): DashboardLocale {
    return getStoredDashboardLocale() ?? getStoredDashboardCookieLocale() ?? getBrowserPreferredLocale();
}

export function getDashboardLocale(): DashboardLocale {
    return currentLocale;
}

export function initializeDashboardLocale(locale: DashboardLocale): void {
    if (typeof window !== "undefined") currentLocale = locale;
}

export function setDashboardLocale(locale: DashboardLocale, persist = true): void {
    currentLocale = locale;

    if (persist && typeof window !== "undefined") {
        try {
            window.localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, locale);
        } catch {
            // Private browsing or a restrictive browser policy should not prevent language changes.
        }
        try {
            const secure = window.location.protocol === "https:" ? "; Secure" : "";
            document.cookie = `${DASHBOARD_LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
        } catch {
            // Cookie restrictions should not prevent the in-memory locale update.
        }
    }

    for (const listener of listeners) listener(locale);
}

export function subscribeDashboardLocale(listener: LocaleListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
