"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import {
    api,
    type UserDigestPausedInput,
    type UserDigestSubscription,
    type UserDigestSubscriptionInput,
} from "@/lib/api-client";

export function useUserDigestSubscription() {
    const { t } = useDashboardI18n();
    const [subscription, setSubscription] = useState<UserDigestSubscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.getUserDigestSubscription();
            setSubscription(result.subscription);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToLoadDigestSubscription");
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [t]);

    const saveSubscription = useCallback(async (input: UserDigestSubscriptionInput) => {
        setSaving(true);
        try {
            const result = await api.saveUserDigestSubscription(input);
            setSubscription(result.subscription);
            setError(null);
            return result.subscription;
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToSaveDigestSubscription");
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [t]);

    const setPaused = useCallback(async (input: UserDigestPausedInput) => {
        setSaving(true);
        try {
            const result = await api.setUserDigestSubscriptionPaused(input);
            setSubscription(result.subscription);
            setError(null);
            return result.subscription;
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToUpdateDigestSubscription");
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [t]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        subscription,
        loading,
        saving,
        error,
        refresh,
        saveSubscription,
        setPaused,
    };
}
