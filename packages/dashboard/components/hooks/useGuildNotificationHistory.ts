import { useCallback, useEffect, useState } from "react";
import { api, type GuildNotificationsResponse } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface UseGuildNotificationHistoryOptions {
    enabled?: boolean;
    limit?: number;
    days?: number;
    provider?: string | null;
}

export function useGuildNotificationHistory(guildId: string, options: UseGuildNotificationHistoryOptions = {}) {
    const { t } = useDashboardI18n();
    const enabled = options.enabled ?? true;
    const limit = options.limit ?? 100;
    const days = options.days;
    const provider = options.provider;
    const [history, setHistory] = useState<GuildNotificationsResponse | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!enabled || !guildId) {
            setHistory(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setHistory(await api.getGuildNotifications(guildId, { limit, days, provider: provider ?? undefined }));
            setError(null);
        } catch (err: unknown) {
            setHistory(null);
            setError(err instanceof Error ? err.message : t("hooks.failedToLoadNotificationHistory"));
        } finally {
            setLoading(false);
        }
    }, [days, enabled, guildId, limit, provider, t]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        history,
        loading,
        error,
        refresh,
    };
}
