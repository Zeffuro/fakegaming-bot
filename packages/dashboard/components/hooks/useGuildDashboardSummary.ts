import { useCallback, useEffect, useState } from "react";
import { api, type GuildDashboardSummary } from "@/lib/api-client";

interface UseGuildDashboardSummaryOptions {
  enabled?: boolean;
}

export function useGuildDashboardSummary(guildId: string, options: UseGuildDashboardSummaryOptions = {}) {
  const enabled = options.enabled ?? true;
  const [summary, setSummary] = useState<GuildDashboardSummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled || !guildId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await api.getGuildDashboardSummary(guildId);
      setSummary(data);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard summary";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled, guildId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary,
  };
}
