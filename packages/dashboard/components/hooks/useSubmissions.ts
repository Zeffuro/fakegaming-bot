"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { submissionsApi, type SubmissionCategory, type SubmissionOptions } from '@/lib/api/submissions';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';

export function useSubmissions(guildId: string, enabled: boolean) {
    const { t } = useDashboardI18n();
    const sequence = useRef(0);
    const [categories, setCategories] = useState<SubmissionCategory[]>([]);
    const [options, setOptions] = useState<SubmissionOptions>({ channels: [], roles: [] });
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const refresh = useCallback(async () => {
        const request = ++sequence.current;
        if (!enabled || !guildId) return;
        setLoading(true);
        setReady(false);
        setError(null);
        try {
            const [nextCategories, nextOptions] = await Promise.all([
                submissionsApi.list(guildId), submissionsApi.options(guildId),
            ]);
            if (request !== sequence.current) return;
            setCategories(nextCategories);
            setOptions(nextOptions);
            setReady(true);
        } catch (err) {
            if (request === sequence.current) setError(err instanceof Error ? err.message : t('submissions.failed'));
        } finally {
            if (request === sequence.current) setLoading(false);
        }
    }, [enabled, guildId, t]);

    useEffect(() => {
        setCategories([]);
        setOptions({ channels: [], roles: [] });
        setReady(false);
        setLoading(enabled);
        void refresh();
        return () => { ++sequence.current; };
    }, [enabled, guildId, refresh]);

    return { categories, options, loading, error, ready, refresh };
}
