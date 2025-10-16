import { useState, useEffect } from "react";
import { CSRF_HEADER_NAME } from "@zeffuro/fakegaming-common/security";

interface User {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string;
  avatar?: string | null;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function useUserData() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const redirectToLogin = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname + window.location.search;
      const returnTo = path || '/dashboard';
      window.location.href = `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
    }
  };

  const tryRefresh = async (): Promise<boolean> => {
    try {
      const csrf = getCookie('csrf');
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { [CSRF_HEADER_NAME]: csrf } as Record<string, string> : undefined,
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt silent refresh once
          const refreshed = await tryRefresh();
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
