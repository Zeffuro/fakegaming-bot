import { useState, useEffect } from "react";
import { redirectToLogin, refreshAuthSession } from "@/lib/auth/clientAuth";

interface User {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string;
  avatar?: string | null;
}

export function useUserData() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt silent refresh once
          const refreshed = await refreshAuthSession();
          if (refreshed) {
            const retry = await fetch('/api/user', { credentials: 'include' });
            if (!retry.ok) {
              redirectToLogin();
              return; // stop further processing; navigation in progress
            }
            const retryData: User = await retry.json();
            setUser(retryData);
            setError(null);
            return;
          }
          // Not refreshed — redirect to OAuth login
          redirectToLogin();
          return; // stop further processing; navigation in progress
        }
        // Non-401 error: set generic error state and bail out
        setError('Failed to fetch user data');
        setUser(null);
        return;
      }

      const userData: User = await response.json();
      setUser(userData);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching user data:', err);
      const message = err instanceof Error ? err.message : 'Failed to load user data';
      setError(message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return user.global_name || user.username || 'User';
  };

  const getUserAvatarUrl = () => {
    if (!user?.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return {
    user,
    loading,
    error,
    getUserDisplayName,
    getUserAvatarUrl,
    refetch: fetchUser
  };
}
