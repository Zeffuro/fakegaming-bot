import { useCallback, useEffect, useState } from "react";
import type { BirthdayConfig } from "@zeffuro/fakegaming-common";
import { api, type BirthdayUpdatePayload } from "@/lib/api-client";
import { useResolvedUsers } from "@/components/hooks/useResolvedUsers";
export type { ResolvedUser } from "@/components/hooks/useResolvedUsers";

export interface BirthdayFormData {
  userId: string;
  channelId: string;
  day: number;
  month: number;
  year?: number;
}

interface UseBirthdaysOptions {
  enabled?: boolean;
}

export function useBirthdays(guildId: string, options: UseBirthdaysOptions = {}) {
  const enabled = options.enabled ?? true;
  const [birthdays, setBirthdays] = useState<BirthdayConfig[]>([]);
  const { userMap, resolveUsers } = useResolvedUsers(guildId, { warningMessage: "Failed to resolve birthday users" });
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBirthdays = useCallback(async () => {
    if (!guildId || !enabled) {
      setLoading(false);
      return;
    }

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
  }, [enabled, guildId, resolveUsers]);

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
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetchBirthdays();
  }, [enabled, fetchBirthdays]);

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
