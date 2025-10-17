import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { disabledModules_get_Response200 } from "@zeffuro/fakegaming-common/api-responses";

export function useGuildModules(guildId: string) {
  const [disabledModules, setDisabledModules] = useState<string[]>([]);
  const [loadingModule, setLoadingModule] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  type DisabledModule = disabledModules_get_Response200 extends (infer U)[] ? U : never;

  const fetchDisabledModules = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getDisabledModules(guildId);
      const arr = data as disabledModules_get_Response200;
      const names = arr
        .map((c: DisabledModule) => (c as any).moduleName as unknown)
        .filter((name: unknown): name is string => typeof name === "string" && name.length > 0);
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
      const data = await api.getDisabledModules(guildId);
      const arr = data as disabledModules_get_Response200;
      const config = arr.find((c: DisabledModule) => (c as any).moduleName === moduleName) as (DisabledModule & { id?: string | number }) | undefined;
      if (config && (config as any).id != null) {
        await api.deleteDisabledModule((config as any).id as string | number);
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
