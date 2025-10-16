import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";

export function useGuildCommands(guildId: string) {
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);
  const [loadingCommand, setLoadingCommand] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchDisabledCommands = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getDisabledCommands(guildId);
      setDisabledCommands(data.map(c => c.commandName).filter((name): name is string => !!name));
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
      const config = data.find(c => c.commandName === commandName);
      if (config && config.id != null) {
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
