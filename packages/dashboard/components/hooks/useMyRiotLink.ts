"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type RiotLinkEntry } from "@/lib/api-client";

export function useMyRiotLink() {
    const [link, setLink] = useState<RiotLinkEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.getMyRiotLink();
            setLink(result.link);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load Riot linked account";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        link,
        loading,
        error,
        refresh,
    };
}
