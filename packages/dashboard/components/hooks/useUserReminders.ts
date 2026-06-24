"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type UserReminder, type UserReminderInput, type UserReminderPausedInput, type UserReminderSnoozeInput } from "@/lib/api-client";

export function useUserReminders() {
    const [reminders, setReminders] = useState<UserReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.listUserReminders();
            setReminders(result.reminders.sort(compareReminders));
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load reminders";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const createReminder = useCallback(async (input: UserReminderInput) => {
        setSaving(true);
        try {
            const reminder = await api.createUserReminder(input);
            setReminders((current) => [reminder, ...current].sort(compareReminders));
            setError(null);
            return reminder;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create reminder";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    const snoozeReminder = useCallback(async (id: string, input: UserReminderSnoozeInput) => {
        setSaving(true);
        try {
            const reminder = await api.snoozeUserReminder(id, input);
            setReminders((current) => current.map((item) => item.id === id ? reminder : item).sort(compareReminders));
            setError(null);
            return reminder;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to snooze reminder";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    const setReminderPaused = useCallback(async (id: string, input: UserReminderPausedInput) => {
        setSaving(true);
        try {
            const reminder = await api.setUserReminderPaused(id, input);
            setReminders((current) => current.map((item) => item.id === id ? reminder : item).sort(compareReminders));
            setError(null);
            return reminder;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update reminder";
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    const deleteReminder = useCallback(async (id: string) => {
        setSaving(true);
        try {
            await api.deleteUserReminder(id);
            setReminders((current) => current.filter((reminder) => reminder.id !== id));
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete reminder";
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
        reminders,
        loading,
        saving,
        error,
        refresh,
        createReminder,
        snoozeReminder,
        setReminderPaused,
        deleteReminder,
    };
}

function compareReminders(left: UserReminder, right: UserReminder): number {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;
    return (left.nextPreviewAt ?? left.timestamp) - (right.nextPreviewAt ?? right.timestamp);
}
