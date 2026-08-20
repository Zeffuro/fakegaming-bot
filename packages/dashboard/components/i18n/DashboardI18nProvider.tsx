"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { DashboardLocale } from "@/lib/i18n/localeStore";
import {
    dashboardLocaleMetadata,
    defaultDashboardLocale,
    getDashboardIntlLocale,
    getInitialDashboardLocale,
    setDashboardLocale as persistDashboardLocale,
} from "@/lib/i18n/localeStore";
import { formatDashboardMessage, type DashboardMessageKey } from "@/lib/i18n/messages";

interface DashboardI18nContextValue {
    locale: DashboardLocale;
    setLocale: (locale: DashboardLocale) => void;
    t: (key: DashboardMessageKey, values?: Record<string, string | number>) => string;
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
}

const DashboardI18nContext = createContext<DashboardI18nContextValue | null>(null);

export function DashboardI18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<DashboardLocale>(defaultDashboardLocale);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const initialLocale = getInitialDashboardLocale();
        persistDashboardLocale(initialLocale, false);
        setLocaleState(initialLocale);
        setReady(true);
    }, []);

    const setLocale = useCallback((nextLocale: DashboardLocale) => {
        persistDashboardLocale(nextLocale);
        setLocaleState(nextLocale);
    }, []);

    useEffect(() => {
        document.documentElement.lang = dashboardLocaleMetadata[locale].htmlLang;
    }, [locale]);

    const value = useMemo<DashboardI18nContextValue>(() => ({
        locale,
        setLocale,
        t: (key, values) => formatDashboardMessage(locale, key, values),
        formatDate: (date, options) => new Intl.DateTimeFormat(getDashboardIntlLocale(locale), options).format(new Date(date)),
        formatNumber: (number, options) => new Intl.NumberFormat(getDashboardIntlLocale(locale), options).format(number),
        formatRelativeTime: (number, unit, options) => new Intl.RelativeTimeFormat(getDashboardIntlLocale(locale), options).format(number, unit),
    }), [locale, setLocale]);

    return (
        <DashboardI18nContext.Provider value={value}>
            {ready ? children : null}
        </DashboardI18nContext.Provider>
    );
}

export function useDashboardI18n(): DashboardI18nContextValue {
    const context = useContext(DashboardI18nContext);
    if (!context) throw new Error("useDashboardI18n must be used inside DashboardI18nProvider");
    return context;
}
