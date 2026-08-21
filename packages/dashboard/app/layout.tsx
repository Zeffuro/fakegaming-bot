import React from "react";
import { getLocale } from "next-intl/server";
import Layout from "../components/Layout";
import { DashboardI18nProvider } from "../components/i18n/DashboardI18nProvider";
import {
    dashboardLocaleMetadata,
    defaultDashboardLocale,
    isDashboardLocale,
} from "../lib/i18n/localeStore";
import './globals.css';

export default async function RootLayout({children}: { children: React.ReactNode }) {
    const requestLocale = await getLocale();
    const locale = isDashboardLocale(requestLocale) ? requestLocale : defaultDashboardLocale;

    return (
        <html lang={dashboardLocaleMetadata[locale].htmlLang}>
        <head>
            <link rel="icon" href="/favicon.ico"/>
            <link rel="manifest" href="/site.webmanifest"/>
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
            <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>
            {/* Add other meta tags as needed */}
        </head>
        <body>
        <Layout>
            <DashboardI18nProvider initialLocale={locale}>{children}</DashboardI18nProvider>
        </Layout>
        </body>
        </html>
    );
}
