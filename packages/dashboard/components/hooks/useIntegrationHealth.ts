import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type IntegrationHealthRecord } from "@/lib/api-client";

interface UseIntegrationHealthOptions {
    enabled?: boolean;
}

export function useIntegrationHealth(guildId: string, provider?: string, options: UseIntegrationHealthOptions = {}) {
    const enabled = options.enabled ?? true;
    const [records, setRecords] = useState<IntegrationHealthRecord[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!enabled || !guildId || !provider) {
            setRecords([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.getIntegrationHealth(guildId, provider);
            setRecords(response.records);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load integration health");
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, guildId, provider]);

    useEffect(() => {
        void load();
    }, [load]);

    const byConfigId = useMemo(() => {
        const map = new Map<string, IntegrationHealthRecord>();
        for (const record of records) {
            map.set(record.configId, record);
        }
        return map;
    }, [records]);

    return {
        records,
        byConfigId,
        loading,
        error,
        refresh: load,
    };
}
