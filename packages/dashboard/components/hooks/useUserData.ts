import { useCallback, useEffect, useState } from "react";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { redirectToLogin, refreshAuthSession } from "@/lib/auth/clientAuth";

interface User {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string;
  avatar?: string | null;
}

export function useUserData() {
  const { t } = useDashboardI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
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
        setError(t("hooks.failedToFetchUserData"));
        setUser(null);
        return;
      }

      const userData: User = await response.json();
      setUser(userData);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching user data:', err);
      const message = err instanceof Error ? err.message : t("hooks.failedToLoadUserData");
      setError(message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const getUserDisplayName = () => {
    if (!user) return t("hooks.userFallback");
    return user.global_name || user.username || t("hooks.userFallback");
  };

  const getUserAvatarUrl = () => {
    if (!user?.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  };

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  return {
    user,
    loading,
    error,
    getUserDisplayName,
    getUserAvatarUrl,
    refetch: fetchUser
  };
}
