import { useState, useCallback } from "react";
import { disabledCommands_guild_guildId_get_Response200, disabledCommands_post_Request } from "@/types/apiResponses";

export function useGuildCommands(guildId: string) {
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);
  const [loadingCommand, setLoadingCommand] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchDisabledCommands = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/external/disabledCommands?guildId=${guildId}`);
      if (!res.ok) throw new Error(await res.text());
      const data: disabledCommands_guild_guildId_get_Response200 = await res.json();
      setDisabledCommands(data.map(c => c.commandName).filter((name): name is string => !!name));
    } catch (err: any) {
      setError(err.message || "Failed to fetch disabled commands");
      setDisabledCommands([]);
    }
  }, [guildId]);

  const disableCommand = useCallback(async (commandName: string) => {
    setLoadingCommand(commandName);
    setError(null);
    try {
      const res = await fetch(`/api/external/disabledCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, commandName } as disabledCommands_post_Request),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchDisabledCommands();
    } catch (err: any) {
      setError(err.message || "Failed to disable command");
    }
    setLoadingCommand(undefined);
  }, [guildId, fetchDisabledCommands]);

  const enableCommand = useCallback(async (commandName: string) => {
    setLoadingCommand(commandName);
    setError(null);
    try {
      const res = await fetch(`/api/external/disabledCommands?guildId=${guildId}`);
      if (!res.ok) throw new Error(await res.text());
      const data: disabledCommands_guild_guildId_get_Response200 = await res.json();
      const config = data.find(c => c.commandName === commandName);
      if (config && config.id) {
        const delRes = await fetch(`/api/external/disabledCommands?id=${config.id}`, { method: "DELETE" });
        if (!delRes.ok) throw new Error(await delRes.text());
      }
      await fetchDisabledCommands();
    } catch (err: any) {
      setError(err.message || "Failed to enable command");
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
