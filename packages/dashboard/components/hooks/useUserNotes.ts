"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { api, type UserNote, type UserNoteInput, type UserNoteUpdateInput } from "@/lib/api-client";

export function useUserNotes() {
    const { t } = useDashboardI18n();
    const [notes, setNotes] = useState<UserNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.listUserNotes();
            setNotes(result.notes);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToLoadNotes");
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [t]);

    const createNote = useCallback(async (input: UserNoteInput) => {
        setSaving(true);
        try {
            const note = await api.createUserNote(input);
            setNotes((current) => [note, ...current].sort(compareNotes));
            setError(null);
            return note;
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToCreateNote");
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [t]);

    const updateNote = useCallback(async (id: string, input: UserNoteUpdateInput) => {
        setSaving(true);
        try {
            const note = await api.updateUserNote(id, input);
            setNotes((current) => current.map((item) => item.id === id ? note : item).sort(compareNotes));
            setError(null);
            return note;
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToUpdateNote");
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [t]);

    const deleteNote = useCallback(async (id: string) => {
        setSaving(true);
        try {
            await api.deleteUserNote(id);
            setNotes((current) => current.filter((note) => note.id !== id));
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : t("hooks.failedToDeleteNote");
            setError(message);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [t]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        notes,
        loading,
        saving,
        error,
        refresh,
        createNote,
        updateNote,
        deleteNote,
    };
}

function compareNotes(left: UserNote, right: UserNote): number {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
}

function toTimestamp(value: string | null): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
