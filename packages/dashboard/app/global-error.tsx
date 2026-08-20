'use client';

import React from 'react';
import { DashboardI18nProvider, useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function GlobalError({
                                        error,
                                        reset,
                                    }: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <DashboardI18nProvider><GlobalErrorContent error={error} reset={reset} /></DashboardI18nProvider>;
}

function GlobalErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const { t } = useDashboardI18n();
    return (
        <html>
        <body>
        <h2>{t("common.error")}</h2>
        {error.digest ? <pre>{error.digest}</pre> : null}
        <button onClick={() => reset()}>{t("common.tryAgain")}</button>
        </body>
        </html>
    );
}
