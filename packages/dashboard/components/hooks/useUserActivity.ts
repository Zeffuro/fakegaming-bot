"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type UserActivityResponse } from "@/lib/api-client";

export function useUserActivity() {
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
            const message = err instanceof Error ? err.message : "Failed to load account activity";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

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
