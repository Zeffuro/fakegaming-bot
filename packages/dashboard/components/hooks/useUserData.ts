import { useState, useEffect } from "react";
import jwt from "jsonwebtoken";

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

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setError(null);
        return;
      }

      try {
        console.log("Falling back to JWT token for user data");

        const cookies = document.cookie.split(';').map(c => c.trim());
        const jwtCookie = cookies.find(c => c.startsWith('jwt='));

        if (jwtCookie) {
          const token = jwtCookie.substring(4);

          const decoded = jwt.decode(token) as any;

          if (decoded) {
            setUser({
              id: decoded.discordId,
              username: decoded.username,
              global_name: decoded.global_name || undefined,
              discriminator: decoded.discriminator || undefined,
              avatar: decoded.avatar || null
            });

            console.log("Successfully recovered user data from JWT token");
            setError(null);
            return;
          }
        }
      } catch (jwtError) {
        console.error("Failed to extract user data from JWT:", jwtError);
      }

      throw new Error('Failed to fetch user data');
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to load user data');
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
