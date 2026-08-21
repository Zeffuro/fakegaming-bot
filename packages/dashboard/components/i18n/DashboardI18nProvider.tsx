"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NextIntlClientProvider, useFormatter, useTranslations } from "next-intl";
import type { DashboardMessageKey } from "@/lib/i18n/messages";
import { dashboardMessages } from "@/lib/i18n/messages";
import type { DashboardLocale } from "@/lib/i18n/localeStore";
import {
    DASHBOARD_DEFAULT_TIME_ZONE,
    dashboardLocaleMetadata,
    defaultDashboardLocale,
    getDashboardIntlLocale,
    getInitialDashboardLocale,
    initializeDashboardLocale,
    setDashboardLocale as persistDashboardLocale,
} from "@/lib/i18n/localeStore";

interface DashboardI18nContextValue {
    locale: DashboardLocale;
    setLocale: (locale: DashboardLocale) => void;
    t: (key: DashboardMessageKey, values?: Record<string, string | number>) => string;
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
}

interface DashboardI18nProviderProps {
    children: React.ReactNode;
    initialLocale?: DashboardLocale;
}

const DashboardI18nContext = createContext<DashboardI18nContextValue | null>(null);

export function DashboardI18nProvider({
    children,
    initialLocale,
}: DashboardI18nProviderProps) {
    const [locale, setLocaleState] = useState<DashboardLocale>(() => {
        const resolvedLocale = initialLocale ?? defaultDashboardLocale;
        initializeDashboardLocale(resolvedLocale);
        return resolvedLocale;
    });
    const [ready, setReady] = useState(initialLocale !== undefined);

    useEffect(() => {
        const browserLocale = getInitialDashboardLocale();
        persistDashboardLocale(browserLocale, false);
        setLocaleState(browserLocale);
        setReady(true);
    }, []);

    const setLocale = useCallback((nextLocale: DashboardLocale) => {
        persistDashboardLocale(nextLocale);
        setLocaleState(nextLocale);
    }, []);

    useEffect(() => {
        document.documentElement.lang = dashboardLocaleMetadata[locale].htmlLang;
    }, [locale]);

    return (
        <NextIntlClientProvider
            locale={locale}
            messages={dashboardMessages[locale]}
            timeZone={DASHBOARD_DEFAULT_TIME_ZONE}
        >
            <DashboardI18nContextBridge locale={locale} setLocale={setLocale}>
                {ready ? children : null}
            </DashboardI18nContextBridge>
        </NextIntlClientProvider>
    );
}

function DashboardI18nContextBridge({
    children,
    locale,
    setLocale,
}: React.PropsWithChildren<Pick<DashboardI18nContextValue, "locale" | "setLocale">>) {
    const translations = useTranslations();
    const formatter = useFormatter();

    const value = useMemo<DashboardI18nContextValue>(() => ({
        locale,
        setLocale,
        t: (key, values) => translations(key, values),
        formatDate: (date, options) => formatter.dateTime(new Date(date), options as never),
        formatNumber: (number, options) => formatter.number(number, options as never),
        formatRelativeTime: (number, unit, options) => new Intl.RelativeTimeFormat(
            getDashboardIntlLocale(locale),
            options,
        ).format(number, unit),
    }), [formatter, locale, setLocale, translations]);

    return (
        <DashboardI18nContext.Provider value={value}>
            {children}
        </DashboardI18nContext.Provider>
    );
}

export function useDashboardI18n(): DashboardI18nContextValue {
    const context = useContext(DashboardI18nContext);
    if (!context) throw new Error("useDashboardI18n must be used inside DashboardI18nProvider");
    return context;
}
