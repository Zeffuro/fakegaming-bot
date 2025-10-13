import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ResolveUsersResponse } from "@/lib/api-client";

export interface QuoteItem {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number;
}

export interface ResolvedUser {
    id: string;
    username?: string;
    global_name?: string | null;
    discriminator?: string | null;
    avatar?: string | null;
    nickname?: string | null;
}

export function useQuotes(guildId: string) {
    const [quotes, setQuotes] = useState<QuoteItem[]>([]);
    const [userMap, setUserMap] = useState<Record<string, ResolvedUser>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState<string>("");

    const fetchQuotes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getQuotesByGuild(guildId);
            setQuotes(data as QuoteItem[]);
            setError(null);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load quotes");
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    const resolveUsers = useCallback(async (ids: string[]) => {
        if (ids.length === 0) return;
        try {
            const unique = Array.from(new Set(ids));
            const batches: string[][] = [];
            for (let i = 0; i < unique.length; i += 50) {
                batches.push(unique.slice(i, i + 50));
            }
            const results: ResolveUsersResponse[] = [];
            for (const batch of batches) {
                const res = await api.resolveUsers(guildId, batch);
                results.push(res);
            }
            const map: Record<string, ResolvedUser> = {};
            for (const r of results) {
                for (const u of r.users) {
                    map[u.id] = u as ResolvedUser;
                }
            }
            setUserMap(prev => ({ ...prev, ...map }));
        } catch (e) {
            // Non-fatal; show raw IDs
            console.warn("Failed to resolve some users", e);
        }
    }, [guildId]);

    const refresh = useCallback(async () => {
        await fetchQuotes();
    }, [fetchQuotes]);

    const addQuote = useCallback(async (payload: Omit<QuoteItem, 'id' | 'guildId' | 'submitterId'> & { id?: string }) => {
        if (!payload.quote || !payload.authorId) {
            setError('Quote and authorId are required');
            return false;
        }
        try {
            setSaving(true);
            await api.createQuote({
                // do not send id; let server generate one (UUID)
                guildId,
                quote: payload.quote,
                authorId: payload.authorId,
                // do not send submitterId; server derives from JWT
                timestamp: payload.timestamp ?? Date.now()
            } as any);
            await refresh();
            // Resolve the two users for display
            await resolveUsers([payload.authorId]);
            return true;
        } catch (e: any) {
            setError(e?.message ?? 'Failed to add quote');
            return false;
        } finally {
            setSaving(false);
        }
    }, [guildId, refresh, resolveUsers]);

    const deleteQuote = useCallback(async (id: string) => {
        try {
            setSaving(true);
            await api.deleteQuote(id);
            await refresh();
            return true;
        } catch (e: any) {
            setError(e?.message ?? 'Failed to delete quote');
            return false;
        } finally {
            setSaving(false);
        }
    }, [refresh]);

    const filtered = useMemo(() => {
        if (!search) return quotes;
        const q = search.toLowerCase();
        return quotes.filter(item => item.quote.toLowerCase().includes(q));
    }, [quotes, search]);

    useEffect(() => {
        if (!guildId) return;
        void fetchQuotes();
    }, [guildId, fetchQuotes]);

    useEffect(() => {
        if (quotes.length === 0) return;
        const ids: string[] = [];
        for (const q of quotes) {
            ids.push(q.authorId);
            ids.push(q.submitterId);
        }
        void resolveUsers(ids);
    }, [quotes, resolveUsers]);

    return {
        quotes: filtered,
        allQuotes: quotes,
        userMap,
        loading,
        saving,
        error,
        setError,
        search,
        setSearch,
        refresh,
        addQuote,
        deleteQuote
    };
}
