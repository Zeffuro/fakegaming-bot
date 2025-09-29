import { useState, useCallback } from "react";
import { ApiClient } from "@/lib/util/apiClient";
import { disabledCommands_guild_guildId_get_Response200, disabledCommands_post_Request } from "@/types/apiResponses";

export function useGuildCommands(guildId: string, token?: string) {
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);
  const [loadingCommand, setLoadingCommand] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const api = new ApiClient(token);

  const fetchDisabledCommands = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<disabledCommands_guild_guildId_get_Response200>(`/disabledCommands/guild/${guildId}`);
      setDisabledCommands(res.map(c => c.commandName).filter((name): name is string => !!name));
    } catch (err: any) {
      setError(err.message || "Failed to fetch disabled commands");
      setDisabledCommands([]);
    }
  }, [guildId, api]);

  const disableCommand = useCallback(async (commandName: string) => {
    setLoadingCommand(commandName);
    setError(null);
    try {
      await api.post<unknown>("/disabledCommands", { guildId, commandName } as disabledCommands_post_Request);
      await fetchDisabledCommands();
    } catch (err: any) {
      setError(err.message || "Failed to disable command");
    }
    setLoadingCommand(undefined);
  }, [guildId, api, fetchDisabledCommands]);

  const enableCommand = useCallback(async (commandName: string) => {
    setLoadingCommand(commandName);
    setError(null);
    try {
      const res = await api.get<disabledCommands_guild_guildId_get_Response200>(`/disabledCommands/guild/${guildId}`);
      const config = res.find(c => c.commandName === commandName);
      if (config) {
        await api.get<unknown>(`/disabledCommands/${config.id}`, { method: "DELETE" });
      }
      await fetchDisabledCommands();
    } catch (err: any) {
      setError(err.message || "Failed to enable command");
    }
    setLoadingCommand(undefined);
  }, [guildId, api, fetchDisabledCommands]);

  return {
    disabledCommands,
    loadingCommand,
    error,
    fetchDisabledCommands,
    disableCommand,
    enableCommand,
  };
}
