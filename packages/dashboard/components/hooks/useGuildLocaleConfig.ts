import { useCallback, useEffect, useState } from 'react';
import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { api } from '@/lib/api-client';

interface UseGuildLocaleConfigOptions {
    enabled?: boolean;
}

export function useGuildLocaleConfig(guildId: string, options: UseGuildLocaleConfigOptions = {}) {
    const enabled = options.enabled ?? true;
    const [outputLocale, setOutputLocale] = useState<SupportedOutputLocale>('en');
    const [loading, setLoading] = useState(enabled);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!enabled || !guildId) {
            setOutputLocale('en');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const config = await api.getGuildLocaleConfig(guildId);
            setOutputLocale(config.outputLocale);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load bot output language');
        } finally {
            setLoading(false);
        }
    }, [enabled, guildId]);

    const updateOutputLocale = useCallback(async (nextLocale: SupportedOutputLocale): Promise<boolean> => {
        if (!enabled || !guildId) return false;
        try {
            setSaving(true);
            const config = await api.updateGuildLocaleConfig(guildId, nextLocale);
            setOutputLocale(config.outputLocale);
            setError(null);
            return true;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save bot output language');
            return false;
        } finally {
            setSaving(false);
        }
    }, [enabled, guildId]);

    useEffect(() => {
        void load();
    }, [load]);

    return { outputLocale, loading, saving, error, reload: load, updateOutputLocale };
}
