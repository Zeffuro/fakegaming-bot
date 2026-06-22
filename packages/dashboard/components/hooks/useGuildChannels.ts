import { useState, useEffect } from "react";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface UseGuildChannelsOptions {
  enabled?: boolean;
}

interface FetchChannelsOptions {
  refresh?: boolean;
}

export function useGuildChannels(guildId: string | string[], options: UseGuildChannelsOptions = {}) {
  const enabled = options.enabled ?? true;
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async (fetchOptions: FetchChannelsOptions = {}) => {
    const guildIdValue = getGuildIdValue(guildId);
    if (!enabled || !guildIdValue) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const refreshParam = fetchOptions.refresh ? "?refresh=1" : "";
      const response = await fetch(`/api/guilds/${encodeURIComponent(guildIdValue)}/channels${refreshParam}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Discord channels');
      }

      const channelData = await response.json();
      setChannels(channelData);
    } catch (err: any) {
      console.error('Error fetching channels:', err);
      setError(err.message || 'Failed to fetch channels');
      // Don't show error for channels as it's not critical for the UI
    } finally {
      setLoading(false);
    }
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(ch => ch.id === channelId);
    return channel ? `#${channel.name}` : channelId;
  };

  useEffect(() => {
    if (!enabled || !guildId) {
      setLoading(false);
      return;
    }

    void fetchChannels();
  }, [enabled, guildId]);

  return {
    channels,
    loading,
    error,
    getChannelName,
    refetch: fetchChannels
  };
}

function getGuildIdValue(guildId: string | string[]): string {
  return Array.isArray(guildId) ? guildId[0] ?? "" : guildId;
}
