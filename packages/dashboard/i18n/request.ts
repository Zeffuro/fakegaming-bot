import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { dashboardMessages } from "../lib/i18n/messages";
import {
    DASHBOARD_DEFAULT_TIME_ZONE,
    DASHBOARD_LOCALE_COOKIE_KEY,
    getDashboardLocaleFromAcceptLanguage,
    isDashboardLocale,
} from "../lib/i18n/localeStore";

export async function getDashboardRequestConfig() {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const preferredLocale = cookieStore.get(DASHBOARD_LOCALE_COOKIE_KEY)?.value;
    const locale = isDashboardLocale(preferredLocale)
        ? preferredLocale
        : getDashboardLocaleFromAcceptLanguage(headerStore.get("accept-language"));

    return {
        locale,
        messages: dashboardMessages[locale],
        timeZone: DASHBOARD_DEFAULT_TIME_ZONE,
    };
}

export default getRequestConfig(getDashboardRequestConfig);
