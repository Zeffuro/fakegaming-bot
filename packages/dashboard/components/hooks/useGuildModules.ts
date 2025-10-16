import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";

export function useGuildModules(guildId: string) {
  const [disabledModules, setDisabledModules] = useState<string[]>([]);
  const [loadingModule, setLoadingModule] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchDisabledModules = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getDisabledModules(guildId);
      setDisabledModules(data.map(c => c.moduleName).filter((name): name is string => !!name));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch disabled modules';
      setError(message);
      setDisabledModules([]);
    }
  }, [guildId]);

  const disableModule = useCallback(async (moduleName: string) => {
    setLoadingModule(moduleName);
    setError(null);
    try {
      await api.createDisabledModule({ guildId, moduleName });
      await fetchDisabledModules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disable module';
      setError(message);
    }
    setLoadingModule(undefined);
  }, [guildId, fetchDisabledModules]);

  const enableModule = useCallback(async (moduleName: string) => {
    setLoadingModule(moduleName);
    setError(null);
    try {
      const data = await api.getDisabledModules(guildId);
      const config = data.find(c => c.moduleName === moduleName);
      if (config && config.id != null) {
        await api.deleteDisabledModule(config.id);
      }
      await fetchDisabledModules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to enable module';
      setError(message);
    }
    setLoadingModule(undefined);
  }, [guildId, fetchDisabledModules]);

  return {
    disabledModules,
    loadingModule,
    error,
    fetchDisabledModules,
    disableModule,
    enableModule,
  };
}
