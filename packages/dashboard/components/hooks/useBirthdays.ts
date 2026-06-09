import { useCallback, useEffect, useState } from "react";
import type { BirthdayConfig } from "@zeffuro/fakegaming-common";
import { api, type BirthdayUpdatePayload, type ResolveUsersResponse } from "@/lib/api-client";

export interface BirthdayFormData {
  userId: string;
  channelId: string;
  day: number;
  month: number;
  year?: number;
}

export interface ResolvedUser {
  id: string;
  username?: string;
  global_name?: string | null;
  discriminator?: string | null;
  avatar?: string | null;
  nickname?: string | null;
}

export function useBirthdays(guildId: string) {
  const [birthdays, setBirthdays] = useState<BirthdayConfig[]>([]);
  const [userMap, setUserMap] = useState<Record<string, ResolvedUser>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveUsers = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return;

    try {
      const results: ResolveUsersResponse[] = [];
      for (let i = 0; i < unique.length; i += 50) {
        results.push(await api.resolveUsers(guildId, unique.slice(i, i + 50)));
      }

      const map: Record<string, ResolvedUser> = {};
      for (const result of results) {
        for (const user of result.users) {
          map[user.id] = user as ResolvedUser;
        }
      }
      setUserMap(prev => ({ ...prev, ...map }));
    } catch (err) {
      console.warn("Failed to resolve birthday users", err);
    }
  }, [guildId]);

  const fetchBirthdays = useCallback(async () => {
    if (!guildId) return;

    try {
      setLoading(true);
      const data = await api.getBirthdays(guildId);
      setBirthdays(data);
      setError(null);
      await resolveUsers(data.map(item => item.userId));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load birthdays");
    } finally {
      setLoading(false);
    }
  }, [guildId, resolveUsers]);

  const addBirthday = useCallback(async (payload: BirthdayFormData) => {
    if (!payload.userId || !payload.channelId || !payload.day || !payload.month) {
      setError("User, channel, day and month are required");
      return false;
    }

    try {
      setSaving(true);
      await api.createBirthday({ ...payload, guildId });
      await fetchBirthdays();
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Failed to add birthday");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchBirthdays, guildId]);

  const updateBirthday = useCallback(async (userId: string, payload: BirthdayUpdatePayload) => {
    try {
      setSaving(true);
      await api.updateBirthday(userId, guildId, payload);
      await fetchBirthdays();
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Failed to update birthday");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchBirthdays, guildId]);

  const deleteBirthday = useCallback(async (userId: string) => {
    try {
      setSaving(true);
      await api.deleteBirthday(userId, guildId);
      await fetchBirthdays();
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete birthday");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchBirthdays, guildId]);

  useEffect(() => {
    void fetchBirthdays();
  }, [fetchBirthdays]);

  return {
    birthdays,
    userMap,
    loading,
    saving,
    error,
    setError,
    refresh: fetchBirthdays,
    addBirthday,
    updateBirthday,
    deleteBirthday,
  };
}
