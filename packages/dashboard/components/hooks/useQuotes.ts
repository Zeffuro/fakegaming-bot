import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useResolvedUsers } from "@/components/hooks/useResolvedUsers";
import { filterQuotesForCuration } from "@/lib/quoteCuration";
import type { QuoteModerationStatus, QuoteOfDayPreviewResponse, QuoteOfDaySettingsRequest } from "@/lib/api/quotes";

export interface QuoteItem {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number;
    tags?: string[];
    source?: string | null;
    context?: string | null;
    moderationStatus?: QuoteModerationStatus | null;
}

export function useQuotes(guildId: string) {
    const [quotes, setQuotes] = useState<QuoteItem[]>([]);
    const { userMap, resolveUsers } = useResolvedUsers(guildId, { warningMessage: "Failed to resolve some users" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [quoteOfDayLoading, setQuoteOfDayLoading] = useState(true);
    const [quoteOfDaySaving, setQuoteOfDaySaving] = useState(false);
    const [quoteOfDayPreview, setQuoteOfDayPreview] = useState<QuoteOfDayPreviewResponse | null>(null);
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

    const fetchQuoteOfDayPreview = useCallback(async () => {
        try {
            setQuoteOfDayLoading(true);
            setQuoteOfDayPreview(await api.getQuoteOfDayPreview(guildId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load quote of the day");
        } finally {
            setQuoteOfDayLoading(false);
        }
    }, [guildId]);

    const refresh = useCallback(async () => {
        await Promise.all([fetchQuotes(), fetchQuoteOfDayPreview()]);
    }, [fetchQuoteOfDayPreview, fetchQuotes]);

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
                timestamp: payload.timestamp ?? Date.now(),
                tags: payload.tags,
                source: payload.source,
                context: payload.context,
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

    const setQuoteModerationStatus = useCallback(async (id: string, moderationStatus: QuoteModerationStatus) => {
        try {
            setSaving(true);
            await api.setQuoteModerationStatus(id, moderationStatus);
            await refresh();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update quote status');
            return false;
        } finally {
            setSaving(false);
        }
    }, [refresh]);

    const updateQuoteOfDaySettings = useCallback(async (payload: QuoteOfDaySettingsRequest) => {
        try {
            setQuoteOfDaySaving(true);
            await api.updateQuoteOfDaySettings(guildId, payload);
            await fetchQuoteOfDayPreview();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save quote of the day settings');
            return false;
        } finally {
            setQuoteOfDaySaving(false);
        }
    }, [fetchQuoteOfDayPreview, guildId]);

    const filtered = useMemo(() => {
        return filterQuotesForCuration(quotes, search, userMap);
    }, [quotes, search, userMap]);

    useEffect(() => {
        if (!guildId) return;
        void fetchQuotes();
        void fetchQuoteOfDayPreview();
    }, [guildId, fetchQuoteOfDayPreview, fetchQuotes]);

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
        quoteOfDayLoading,
        quoteOfDaySaving,
        quoteOfDayPreview,
        error,
        setError,
        search,
        setSearch,
        refresh,
        addQuote,
        deleteQuote,
        setQuoteModerationStatus,
        updateQuoteOfDaySettings
    };
}
