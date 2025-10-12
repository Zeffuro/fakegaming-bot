import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";

/** Minimal shape for configs that contain a game field */
export interface HasGameField {
    game: string;
}

export interface LatestPatchInfo {
    version?: string;
    publishedAt?: number;
}

export interface UseLatestPatchNotesResult {
    latestByGame: Record<string, LatestPatchInfo>;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * useLatestPatchNotes
 * Computes unique games from provided configs and fetches latest patch info per game.
 */
export function useLatestPatchNotes<T extends HasGameField>(configs: T[] | null | undefined): UseLatestPatchNotesResult {
    const [latestByGame, setLatestByGame] = useState<Record<string, LatestPatchInfo>>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const cancelRef = useRef<boolean>(false);

    const uniqueGames = useMemo(() => {
        const set = new Set<string>();
        for (const c of configs ?? []) {
            if (typeof c?.game === 'string' && c.game.length > 0) set.add(c.game);
        }
        return Array.from(set);
    }, [configs]);

    const fetchLatest = async () => {
        if (uniqueGames.length === 0) {
            setLatestByGame({});
            setError(null);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            cancelRef.current = false;
            // Fetch in parallel; tolerate per-game failures
            const results = await Promise.allSettled(uniqueGames.map(g => api.getLatestPatchNote(g)));
            if (cancelRef.current) return;
            const map: Record<string, LatestPatchInfo> = {};
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const g = uniqueGames[i];
                if (r.status === 'fulfilled' && r.value && typeof r.value === 'object') {
                    const v: any = r.value as any;
                    map[g] = { version: v.version, publishedAt: v.publishedAt };
                }
            }
            setLatestByGame(map);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load latest patch notes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cancelRef.current = false;
        void fetchLatest();
        return () => { cancelRef.current = true; };
    }, [uniqueGames.join('\u0001')]);

    return { latestByGame, loading, error, refresh: fetchLatest };
}

