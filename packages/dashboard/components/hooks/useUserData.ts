import { useState, useEffect } from "react";

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
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      setUser(userData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to load user data');
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
