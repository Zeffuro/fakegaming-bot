import { useState, useEffect } from "react";
import { redirectToLogin, refreshAuthSession } from "@/lib/auth/clientAuth";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  member_count?: number;
}

interface DashboardData {
  guilds: Guild[];
  isAdmin: boolean;
}

interface FetchDashboardDataOptions {
  refresh?: boolean;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({ guilds: [], isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (options: FetchDashboardDataOptions = {}) => {
    try {
      setLoading(true);
      const url = options.refresh ? '/api/guilds?refresh=1' : '/api/guilds';
      let response = await fetch(url, {
        credentials: 'include'
      });

      if (response.status === 401) {
        const refreshed = await refreshAuthSession();
        if (refreshed) {
          response = await fetch(url, {
            credentials: 'include'
          });
        } else {
          redirectToLogin();
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to fetch guilds');
      }

      const result = await response.json();
      setData({
        guilds: result.guilds || [],
        isAdmin: result.isAdmin || false
      });
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    ...data,
    loading,
    error,
    refetch: fetchData
  };
}
