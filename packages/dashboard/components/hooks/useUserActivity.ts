"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { api, type UserActivityResponse } from "@/lib/api-client";

export function useUserActivity() {
    const { t } = useDashboardI18n();
    const [activity, setActivity] = useState<UserActivityResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.getUserActivity({ auditLimit: 8, deliveryLimit: 5 });
            setActivity(result);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToLoadAccountActivity");
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        activity,
        loading,
        error,
        refresh,
    };
}
