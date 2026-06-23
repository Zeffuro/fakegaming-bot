import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useResolvedUsers } from "@/components/hooks/useResolvedUsers";
import { filterQuotesForCuration } from "@/lib/quoteCuration";

export interface QuoteItem {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number;
}

export function useQuotes(guildId: string) {
    const [quotes, setQuotes] = useState<QuoteItem[]>([]);
    const { userMap, resolveUsers } = useResolvedUsers(guildId, { warningMessage: "Failed to resolve some users" });
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
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load quotes");
        } finally {
            setLoading(false);
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
                guildId,
                quote: payload.quote,
                authorId: payload.authorId,
                timestamp: payload.timestamp ?? Date.now()
            });
            await refresh();
            // Resolve the two users for display
            await resolveUsers([payload.authorId]);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add quote');
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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete quote');
            return false;
        } finally {
            setSaving(false);
        }
    }, [refresh]);

    const filtered = useMemo(() => {
        return filterQuotesForCuration(quotes, search, userMap);
    }, [quotes, search, userMap]);

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
