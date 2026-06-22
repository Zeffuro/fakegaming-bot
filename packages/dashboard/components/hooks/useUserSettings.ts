"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type UserSettings, type UserSettingsUpdateInput } from "@/lib/api-client";

export function useUserSettings() {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.getUserSettings();
            setSettings(result);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load user settings";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (input: UserSettingsUpdateInput) => {
        setSaving(true);
        try {
            const result = await api.updateUserSettings(input);
            setSettings(result);
            setError(null);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update user settings";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        settings,
        loading,
        saving,
        error,
        refresh,
        updateSettings,
    };
}
