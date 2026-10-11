"use client";

import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { noteTasksApi, type LinkedNoteTask } from "@/lib/api/noteTasks";
import { userSettingsApi } from "@/lib/api/userSettings";
import type { UserNote } from "@/lib/api/userNotes";

export function NoteTaskDialog({ note, onClose, onLinked }: {
    note: UserNote;
    onClose: () => void;
    onLinked?: (taskId: string) => void;
}) {
    const { t, formatDate } = useDashboardI18n();
    const [title, setTitle] = useState(note.title.slice(0, 120));
    const [due, setDue] = useState("");
    const [timezone, setTimezone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ task: LinkedNoteTask; created: boolean } | null>(null);

    useEffect(() => {
        let active = true;
        void userSettingsApi.getUserSettings().then(settings => {
            if (active) setTimezone(settings.timezone?.trim() || "UTC");
        }).catch(err => { if (active) setError(err instanceof Error ? err.message : t("notesTask.failed")); });
        return () => { active = false; };
    }, [t]);

    async function submit() {
        if (busy || timezone === null || !title.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const value = await noteTasksApi.createTaskFromNote(note.id, { title: title.trim(), due: due || null, timezone });
            setResult(value);
            onLinked?.(value.task.id);
            window.dispatchEvent(new Event("personal-today-refresh"));
        } catch (err) { setError(err instanceof Error ? err.message : t("notesTask.failed")); }
        finally { setBusy(false); }
    }

    return <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { bgcolor: "#101725", color: "grey.50", backgroundImage: "none" } } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{t("notesTask.title")}</DialogTitle>
        <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
                {error && <Alert severity="error">{error}</Alert>}
                {result ? <>
                    <Alert severity="success">{t(result.created ? "notesTask.success" : "notesTask.reused")}</Alert>
                    <Typography sx={{ overflowWrap: "anywhere", fontWeight: 800 }}>{result.task.title}</Typography>
                    <Typography>{result.task.state === "completed" ? t("notesTask.completed") : result.task.dueAt === null ? t("notesTask.noDue")
                        : t("notesTask.due", { date: formatDate(result.task.dueAt, { timeZone: result.task.timezone, dateStyle: "medium", timeStyle: "short" }) })}</Typography>
                    <Typography sx={{ overflowWrap: "anywhere" }}>{t("notesTask.taskId", { id: result.task.id })}</Typography>
                </> : <>
                    {note.linkedTaskId && <Alert severity="info">{t("notesTask.existing")}</Alert>}
                    <TextField label={t("notesTask.titleLabel")} value={title} onChange={event => setTitle(event.target.value)} disabled={busy || Boolean(note.linkedTaskId)} slotProps={{ htmlInput: { maxLength: 120 } }} sx={dashboardFieldSx(dashboardAccents.commands)} />
                    <TextField type="datetime-local" label={t("notesTask.dueLabel")} value={due} onChange={event => setDue(event.target.value)} disabled={busy || Boolean(note.linkedTaskId)} helperText={t("notesTask.dueHelp")} slotProps={{ inputLabel: { shrink: true } }} sx={dashboardFieldSx(dashboardAccents.commands)} />
                    <Typography sx={{ color: "grey.300", overflowWrap: "anywhere" }}>{timezone === null ? t("notesTask.loading") : t("notesTask.timezone", { timezone })}</Typography>
                </>}
                <Box sx={{ color: "grey.400", overflowWrap: "anywhere" }}>{t("notesTask.retained")}</Box>
            </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button disabled={busy} onClick={onClose} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t("notesTask.cancel")}</Button>
            {!result && <Button disabled={busy || timezone === null || !title.trim()} onClick={() => void submit()} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                {t(busy ? "notesTask.busy" : note.linkedTaskId ? "notesTask.open" : "notesTask.submit")}
            </Button>}
        </DialogActions>
    </Dialog>;
}
