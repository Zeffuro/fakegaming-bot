import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export interface UseSupportedGamesResult {
    games: string[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useSupportedGames(): UseSupportedGamesResult {
    const { t } = useDashboardI18n();
    const [games, setGames] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGames = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getSupportedGames();
            setGames(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e?.message ?? t('hooks.failedToLoadSupportedGames'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchGames();
    }, []);

    return { games, loading, error, refresh: fetchGames };
}
