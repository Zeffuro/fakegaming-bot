import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { disabledCommands_get_Response200 } from "@zeffuro/fakegaming-common/api-responses";

export function useGuildCommands(guildId: string) {
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);
  const [loadingCommand, setLoadingCommand] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  type DisabledCommandArr = disabledCommands_get_Response200;
  type DisabledCommandItem = { id?: string | number; commandName?: string | null };
  const isDisabledCommandItem = (v: unknown): v is DisabledCommandItem =>
    typeof v === "object" && v !== null && ("commandName" in (v as Record<string, unknown>) || "id" in (v as Record<string, unknown>));

  const fetchDisabledCommands = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getDisabledCommands(guildId);
      const arr = data as DisabledCommandArr | unknown[];
      const names = (Array.isArray(arr) ? arr : [])
        .map((c: unknown) => (isDisabledCommandItem(c) && typeof c.commandName === "string" ? c.commandName : undefined))
        .filter((name): name is string => typeof name === "string" && name.length > 0);
      setDisabledCommands(names);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch disabled commands";
      setError(message);
      setDisabledCommands([]);
    }
  }, [guildId]);

  const disableCommand = useCallback(async (commandName: string) => {
    setLoadingCommand(commandName);
    setError(null);
    try {
      await api.createDisabledCommand({ guildId, commandName });
      await fetchDisabledCommands();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to disable command";
      setError(message);
    }
    setLoadingCommand(undefined);
  }, [guildId, fetchDisabledCommands]);

  const enableCommand = useCallback(async (commandName: string) => {
    setLoadingCommand(commandName);
    setError(null);
    try {
      const data = await api.getDisabledCommands(guildId);
      const arr = (data as DisabledCommandArr | unknown[]);
      const config = (Array.isArray(arr) ? arr : []).find((c: unknown): c is DisabledCommandItem => isDisabledCommandItem(c) && c.commandName === commandName);
      if (config && typeof config.id !== "undefined") {
        await api.deleteDisabledCommand(config.id);
      }
      await fetchDisabledCommands();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to enable command";
      setError(message);
    }
    setLoadingCommand(undefined);
  }, [guildId, fetchDisabledCommands]);

  return {
    disabledCommands,
    loadingCommand,
    error,
    fetchDisabledCommands,
    disableCommand,
    enableCommand,
  };
}
