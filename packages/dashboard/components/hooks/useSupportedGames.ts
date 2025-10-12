import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export interface UseSupportedGamesResult {
    games: string[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useSupportedGames(): UseSupportedGamesResult {
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
            setError(e?.message ?? 'Failed to load supported games');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchGames();
    }, []);

    return { games, loading, error, refresh: fetchGames };
}
