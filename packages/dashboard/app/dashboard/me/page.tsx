"use client";

import React, { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    Add,
    Delete,
    Edit,
    NoteAlt,
    PushPin,
    Save,
    Schedule,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import {
    dashboardAccents,
    dashboardCardSx,
    dashboardFieldSx,
    ghostActionButtonSx,
    primaryActionButtonSx,
} from "@/components/dashboard/dashboardTheme";
import { useUserNotes } from "@/components/hooks/useUserNotes";
import type { UserNote } from "@/lib/api-client";

const emptyForm = {
    title: "",
    body: "",
    pinned: false,
};

type NoteFormState = typeof emptyForm;

export default function PersonalDashboardPage() {
    const { notes, loading, saving, error, createNote, updateNote, deleteNote } = useUserNotes();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<NoteFormState>(emptyForm);
    const [localError, setLocalError] = useState<string | null>(null);

    const editingNote = useMemo(
        () => notes.find((note) => note.id === editingId) ?? null,
        [editingId, notes],
    );

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setLocalError(null);
    };

    const startEdit = (note: UserNote) => {
        setEditingId(note.id);
        setForm({
            title: note.title,
            body: note.body,
            pinned: note.pinned,
        });
        setLocalError(null);
    };

    const submitForm = async () => {
        const title = form.title.trim();
        const body = form.body;
        if (!title && !body.trim()) {
            setLocalError("Add a title or note before saving.");
            return;
        }

        try {
            if (editingNote) {
                await updateNote(editingNote.id, {
                    title,
                    body,
                    pinned: form.pinned,
                });
            } else {
                await createNote({
                    title,
                    body,
                    pinned: form.pinned,
                });
            }
            resetForm();
        } catch {
            // Hook exposes the error state.
        }
    };

    const togglePinned = async (note: UserNote) => {
        try {
            await updateNote(note.id, { pinned: !note.pinned });
        } catch {
            // Hook exposes the error state.
        }
    };

    const removeNote = async (note: UserNote) => {
        if (!window.confirm(`Delete "${note.title}"?`)) return;
        try {
            await deleteNote(note.id);
            if (editingId === note.id) resetForm();
        } catch {
            // Hook exposes the error state.
        }
    };

    return (
        <DashboardLayout loading={loading} maxWidth="xl">
            <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.quotes}>
                <FeatureHero
                    icon={<NoteAlt />}
                    eyebrow="Personal"
                    title="Your dashboard"
                    description="Personal notes live outside server settings and follow your Discord login."
                    accent={dashboardAccents.commands}
                    secondaryAccent={dashboardAccents.quotes}
                    stats={[
                        { label: "notes", value: notes.length },
                        { label: "pinned", value: notes.filter((note) => note.pinned).length },
                    ]}
                    actions={(
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={resetForm}
                            sx={primaryActionButtonSx(dashboardAccents.commands)}
                        >
                            New note
                        </Button>
                    )}
                />

                <Stack spacing={3}>
                    {(error || localError) && (
                        <Alert severity="error" sx={{ bgcolor: "rgba(127,29,29,0.52)", color: "error.light" }}>
                            {localError ?? error}
                        </Alert>
                    )}

                    <FeaturePanel accent={dashboardAccents.commands}>
                        <Stack spacing={2.5} sx={{ position: "relative" }}>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
                                <Box>
                                    <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                        {editingNote ? "Edit note" : "Create note"}
                                    </Typography>
                                    <Typography sx={{ color: "rgba(255,255,255,0.62)", mt: 0.5 }}>
                                        Do not store passwords, API keys, tokens, recovery codes, private keys, or other secrets.
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                                    <Typography sx={{ color: "grey.300", fontWeight: 700 }}>Pinned</Typography>
                                    <Switch
                                        checked={form.pinned}
                                        onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
                                    />
                                </Stack>
                            </Stack>

                            <TextField
                                label="Title (optional)"
                                value={form.title}
                                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                slotProps={{ htmlInput: { maxLength: 160 } }}
                                fullWidth
                                sx={dashboardFieldSx(dashboardAccents.commands)}
                            />
                            <TextField
                                label="Note"
                                value={form.body}
                                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                                multiline
                                minRows={5}
                                slotProps={{ htmlInput: { maxLength: 20000 } }}
                                fullWidth
                                sx={dashboardFieldSx(dashboardAccents.commands)}
                            />
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                <Button
                                    variant="contained"
                                    startIcon={<Save />}
                                    disabled={saving}
                                    onClick={submitForm}
                                    sx={primaryActionButtonSx(dashboardAccents.commands)}
                                >
                                    {editingNote ? "Save changes" : "Save note"}
                                </Button>
                                {editingNote && (
                                    <Button
                                        variant="outlined"
                                        onClick={resetForm}
                                        sx={ghostActionButtonSx(dashboardAccents.commands)}
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </FeaturePanel>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 3 }}>
                        <FeaturePanel accent={dashboardAccents.quotes}>
                            <Stack spacing={2.25} sx={{ position: "relative" }}>
                                <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                    Notes
                                </Typography>
                                {notes.length === 0 ? (
                                    <Box sx={{ py: 5, textAlign: "center", color: "rgba(255,255,255,0.58)" }}>
                                        <NoteAlt sx={{ fontSize: 42, mb: 1, color: alpha(dashboardAccents.commands, 0.78) }} />
                                        <Typography sx={{ fontWeight: 800 }}>No notes yet</Typography>
                                    </Box>
                                ) : (
                                    <Stack spacing={1.5}>
                                        {notes.map((note) => (
                                            <Box key={note.id} sx={{ ...dashboardCardSx(note.pinned ? dashboardAccents.commands : dashboardAccents.quotes), p: 2.25 }}>
                                                <Stack spacing={1.5} sx={{ position: "relative" }}>
                                                    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                                                                <Typography sx={{ color: "grey.50", fontWeight: 900, overflowWrap: "anywhere" }}>
                                                                    {note.title}
                                                                </Typography>
                                                                {note.pinned && (
                                                                    <Chip
                                                                        icon={<PushPin fontSize="small" />}
                                                                        label="Pinned"
                                                                        size="small"
                                                                        sx={{ bgcolor: alpha(dashboardAccents.commands, 0.16), color: "grey.50" }}
                                                                    />
                                                                )}
                                                            </Stack>
                                                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>
                                                                Updated {formatDate(note.updatedAt)}
                                                            </Typography>
                                                        </Box>
                                                        <Stack direction="row" spacing={0.5}>
                                                            <Tooltip title={note.pinned ? "Unpin" : "Pin"}>
                                                                <IconButton
                                                                    aria-label={note.pinned ? "Unpin note" : "Pin note"}
                                                                    onClick={() => void togglePinned(note)}
                                                                    sx={{ color: note.pinned ? dashboardAccents.commands : "grey.300" }}
                                                                >
                                                                    <PushPin fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Edit">
                                                                <IconButton aria-label="Edit note" onClick={() => startEdit(note)} sx={{ color: "grey.300" }}>
                                                                    <Edit fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete">
                                                                <IconButton aria-label="Delete note" onClick={() => void removeNote(note)} sx={{ color: dashboardAccents.quotes }}>
                                                                    <Delete fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </Stack>
                                                    {note.body ? (
                                                        <>
                                                            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                                                            <Typography sx={{ color: "rgba(255,255,255,0.74)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                                                                {note.body}
                                                            </Typography>
                                                        </>
                                                    ) : null}
                                                </Stack>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        </FeaturePanel>

                        <FeaturePanel accent={dashboardAccents.birthdays}>
                            <Stack spacing={2} sx={{ position: "relative" }}>
                                <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                    Personal features
                                </Typography>
                                <PersonalFeatureRow
                                    icon={<NoteAlt />}
                                    title="Notes"
                                    body={`${notes.length} saved`}
                                    accent={dashboardAccents.commands}
                                />
                                <PersonalFeatureRow
                                    icon={<Schedule />}
                                    title="Reminders"
                                    body="Dashboard management is a future track"
                                    accent={dashboardAccents.birthdays}
                                />
                            </Stack>
                        </FeaturePanel>
                    </Box>
                </Stack>
            </FeatureShell>
        </DashboardLayout>
    );
}

function PersonalFeatureRow({ icon, title, body, accent }: { icon: React.ReactNode; title: string; body: string; accent: string }) {
    return (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "grey.50", bgcolor: alpha(accent, 0.16) }}>
                {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: "grey.50", fontWeight: 850 }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)" }}>{body}</Typography>
            </Box>
        </Stack>
    );
}

function formatDate(value: string | null): string {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}
