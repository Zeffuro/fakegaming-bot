"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

export function useUserAnimeSubscriptions() {
    const [subscriptions, setSubscriptions] = useState<AnimeSubscriptionDashboardConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.getMyAnimeSubscriptions();
            setSubscriptions(result.sort(compareAnimeSubscriptions));
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load anime subscriptions";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const togglePaused = useCallback(async (subscription: AnimeSubscriptionDashboardConfig) => {
        if (!subscription.id) return null;
        setSaving(true);
        try {
            const updated = await api.setAnimeSubscriptionPaused(subscription.id, !subscription.paused);
            setSubscriptions((current) => current.map((item) => item.id === updated.id ? updated : item).sort(compareAnimeSubscriptions));
            setError(null);
            return updated;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update anime subscription";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    const deleteSubscription = useCallback(async (subscription: AnimeSubscriptionDashboardConfig) => {
        if (!subscription.id) return;
        setSaving(true);
        try {
            await api.deleteAnimeSubscription(subscription.id);
            setSubscriptions((current) => current.filter((item) => item.id !== subscription.id));
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete anime subscription";
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
        subscriptions,
        loading,
        saving,
        error,
        refresh,
        togglePaused,
        deleteSubscription,
    };
}

function compareAnimeSubscriptions(left: AnimeSubscriptionDashboardConfig, right: AnimeSubscriptionDashboardConfig): number {
    const pausedDelta = Number(Boolean(left.paused)) - Number(Boolean(right.paused));
    if (pausedDelta !== 0) return pausedDelta;
    return (left.animeTitle || "").localeCompare(right.animeTitle || "");
}
