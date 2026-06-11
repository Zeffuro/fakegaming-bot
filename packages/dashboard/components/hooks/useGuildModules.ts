import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";

type DisabledModulesResponse = Awaited<ReturnType<typeof api.getDisabledModules>>;
type DisabledModule = DisabledModulesResponse extends (infer Item)[] ? Item : never;

function getModuleName(config: DisabledModule): string | undefined {
  return typeof config.moduleName === "string" && config.moduleName.length > 0 ? config.moduleName : undefined;
}

export function useGuildModules(guildId: string) {
  const [disabledModules, setDisabledModules] = useState<string[]>([]);
  const [loadingModule, setLoadingModule] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchDisabledModules = useCallback(async () => {
    setError(null);
    try {
      const data: DisabledModulesResponse = await api.getDisabledModules(guildId);
      const names = data
        .map(getModuleName)
        .filter((name: string | undefined): name is string => typeof name === "string");
      setDisabledModules(names);
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
      const data: DisabledModulesResponse = await api.getDisabledModules(guildId);
      const config = data.find((c: DisabledModule) => c.moduleName === moduleName);
      if (config?.id != null) {
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
