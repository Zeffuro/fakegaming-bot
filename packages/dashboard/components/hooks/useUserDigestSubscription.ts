"use client";

import { useCallback, useEffect, useState } from "react";
import {
    api,
    type UserDigestPausedInput,
    type UserDigestSubscription,
    type UserDigestSubscriptionInput,
} from "@/lib/api-client";

export function useUserDigestSubscription() {
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
            const message = err instanceof Error ? err.message : "Failed to load digest subscription";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const saveSubscription = useCallback(async (input: UserDigestSubscriptionInput) => {
        setSaving(true);
        try {
            const result = await api.saveUserDigestSubscription(input);
            setSubscription(result.subscription);
            setError(null);
            return result.subscription;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save digest subscription";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    const setPaused = useCallback(async (input: UserDigestPausedInput) => {
        setSaving(true);
        try {
            const result = await api.setUserDigestSubscriptionPaused(input);
            setSubscription(result.subscription);
            setError(null);
            return result.subscription;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update digest subscription";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

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
