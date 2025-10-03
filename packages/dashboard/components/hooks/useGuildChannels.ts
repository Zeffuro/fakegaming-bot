import { useState, useEffect } from "react";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export function useGuildChannels(guildId: string | string[]) {
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/guilds/${guildId}/channels`, {
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
    if (guildId) {
      fetchChannels();
    }
  }, [guildId]);

  return {
    channels,
    loading,
    error,
    getChannelName,
    refetch: fetchChannels
  };
}
