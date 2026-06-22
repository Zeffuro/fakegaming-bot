"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    InputAdornment,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    AccessTime,
    Add,
    AlarmAdd,
    Delete,
    Edit,
    ManageAccounts,
    NoteAlt,
    NotificationsActive,
    Movie,
    PushPin,
    Save,
    Schedule,
    Search,
    WarningAmber,
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
import { subscriptionMeta, subscriptionTitle } from "@/components/anime/animeUtils";
import { useUserAnimeSubscriptions } from "@/components/hooks/useUserAnimeSubscriptions";
import { useUserNotes } from "@/components/hooks/useUserNotes";
import { useUserReminders } from "@/components/hooks/useUserReminders";
import { useUserSettings } from "@/components/hooks/useUserSettings";
import type { AnimeSubscriptionDashboardConfig, UserNote, UserReminder, UserSettingsUpdateInput } from "@/lib/api-client";

const emptyNoteForm = {
    title: "",
    body: "",
    pinned: false,
};

const emptyReminderForm = {
    message: "",
    timespan: "1h",
};

const emptySettingsForm = {
    timezone: "",
    defaultReminderTimeSpan: "",
};

type NoteFormState = typeof emptyNoteForm;
type ReminderFormState = typeof emptyReminderForm;
type SettingsFormState = typeof emptySettingsForm;

export default function PersonalDashboardPage() {
    const { notes, loading: notesLoading, saving: notesSaving, error: notesError, createNote, updateNote, deleteNote } = useUserNotes();
    const {
        reminders,
        loading: remindersLoading,
        saving: remindersSaving,
        error: remindersError,
        createReminder,
        snoozeReminder,
        deleteReminder,
    } = useUserReminders();
    const {
        subscriptions: animeSubscriptions,
        loading: animeLoading,
        saving: animeSaving,
        error: animeError,
        togglePaused: toggleAnimePaused,
        deleteSubscription: deleteAnimeSubscription,
    } = useUserAnimeSubscriptions();
    const {
        settings,
        loading: settingsLoading,
        saving: settingsSaving,
        error: settingsError,
        updateSettings,
    } = useUserSettings();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [noteForm, setNoteForm] = useState<NoteFormState>(emptyNoteForm);
    const [reminderForm, setReminderForm] = useState<ReminderFormState>(emptyReminderForm);
    const [settingsForm, setSettingsForm] = useState<SettingsFormState>(emptySettingsForm);
    const [noteQuery, setNoteQuery] = useState("");
    const [noteLocalError, setNoteLocalError] = useState<string | null>(null);
    const [reminderLocalError, setReminderLocalError] = useState<string | null>(null);
    const [settingsLocalError, setSettingsLocalError] = useState<string | null>(null);

    useEffect(() => {
        setSettingsForm({
            timezone: settings?.timezone ?? "",
            defaultReminderTimeSpan: settings?.defaultReminderTimeSpan ?? "",
        });
    }, [settings]);

    const editingNote = useMemo(
        () => notes.find((note) => note.id === editingId) ?? null,
        [editingId, notes],
    );
    const filteredNotes = useMemo(() => {
        const query = noteQuery.trim().toLowerCase();
        if (!query) return notes;
        return notes.filter((note) =>
            note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query)
        );
    }, [noteQuery, notes]);

    const pageError = noteLocalError ?? reminderLocalError ?? settingsLocalError ?? notesError ?? remindersError ?? animeError ?? settingsError;
    const loading = notesLoading || remindersLoading || animeLoading || settingsLoading;
    const saving = notesSaving || remindersSaving || animeSaving || settingsSaving;

    const resetNoteForm = () => {
        setEditingId(null);
        setNoteForm(emptyNoteForm);
        setNoteLocalError(null);
    };

    const startEdit = (note: UserNote) => {
        setEditingId(note.id);
        setNoteForm({
            title: note.title,
            body: note.body,
            pinned: note.pinned,
        });
        setNoteLocalError(null);
    };

    const submitNoteForm = async () => {
        const title = noteForm.title.trim();
        const body = noteForm.body;
        if (!title && !body.trim()) {
            setNoteLocalError("Add a title or note before saving.");
            return;
        }

        try {
            if (editingNote) {
                await updateNote(editingNote.id, {
                    title,
                    body,
                    pinned: noteForm.pinned,
                });
            } else {
                await createNote({
                    title,
                    body,
                    pinned: noteForm.pinned,
                });
            }
            resetNoteForm();
        } catch {
            // Hook exposes the error state.
        }
    };

    const submitReminderForm = async () => {
        const message = reminderForm.message.trim();
        const timespan = reminderForm.timespan.trim();
        if (!message) {
            setReminderLocalError("Add a reminder message before saving.");
            return;
        }
        if (!timespan) {
            setReminderLocalError("Add when you want to be reminded, such as 10m, 1h, or 2d.");
            return;
        }

        try {
            await createReminder({ message, timespan });
            setReminderForm(emptyReminderForm);
            setReminderLocalError(null);
        } catch {
            // Hook exposes the error state.
        }
    };

    const submitSettingsForm = async () => {
        const timezone = settingsForm.timezone.trim();
        const defaultReminderTimeSpan = settingsForm.defaultReminderTimeSpan.trim();
        const input: UserSettingsUpdateInput = {};
        if (timezone) input.timezone = timezone;
        if (defaultReminderTimeSpan) input.defaultReminderTimeSpan = defaultReminderTimeSpan;
        if (!input.timezone && !input.defaultReminderTimeSpan) {
            setSettingsLocalError("Add a timezone, default reminder interval, or both before saving settings.");
            return;
        }

        try {
            await updateSettings(input);
            setSettingsLocalError(null);
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
            if (editingId === note.id) resetNoteForm();
        } catch {
            // Hook exposes the error state.
        }
    };

    const snoozeReminderBy = async (reminder: UserReminder, timespan: string) => {
        try {
            await snoozeReminder(reminder.id, { timespan });
            setReminderLocalError(null);
        } catch {
            // Hook exposes the error state.
        }
    };

    const removeReminder = async (reminder: UserReminder) => {
        if (!window.confirm(`Delete reminder "${reminder.message}"?`)) return;
        try {
            await deleteReminder(reminder.id);
        } catch {
            // Hook exposes the error state.
        }
    };

    const removeAnimeSubscription = async (subscription: AnimeSubscriptionDashboardConfig) => {
        if (!window.confirm(`Remove anime subscription "${subscriptionTitle(subscription)}"?`)) return;
        try {
            await deleteAnimeSubscription(subscription);
        } catch {
            // Hook exposes the error state.
        }
    };

    return (
        <DashboardLayout
            loading={loading}
            maxWidth="xl"
            currentTrail={[{ label: "Your dashboard", href: null, icon: <NoteAlt sx={{ fontSize: 16 }} /> }]}
        >
            <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.birthdays}>
                <FeatureHero
                    icon={<NoteAlt />}
                    eyebrow="Personal"
                    title="Your dashboard"
                    description="Account-level notes, reminders, settings, and DM subscriptions that follow your Discord login instead of a server."
                    accent={dashboardAccents.commands}
                    secondaryAccent={dashboardAccents.birthdays}
                    stats={[
                        { label: "notes", value: notes.length },
                        { label: "pinned", value: notes.filter((note) => note.pinned).length },
                        { label: "reminders", value: reminders.length },
                        { label: "anime subs", value: animeSubscriptions.length },
                    ]}
                    actions={(
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={resetNoteForm}
                            sx={primaryActionButtonSx(dashboardAccents.commands)}
                        >
                            New note
                        </Button>
                    )}
                />

                <Stack spacing={3}>
                    {pageError && (
                        <Alert severity="error" sx={{ bgcolor: "rgba(127,29,29,0.52)", color: "error.light" }}>
                            {pageError}
                        </Alert>
                    )}

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.45fr) minmax(360px, 0.8fr)" }, gap: 3 }}>
                        <Stack spacing={3} sx={{ minWidth: 0 }}>
                            <FeaturePanel accent={dashboardAccents.commands}>
                                <Stack spacing={2.5} sx={{ position: "relative" }}>
                                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                {editingNote ? "Edit note" : "Create note"}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.62)", mt: 0.5 }}>
                                                Titles are optional. Blank titles use the first line of the note.
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                                            <Typography sx={{ color: "grey.300", fontWeight: 700 }}>Pinned</Typography>
                                            <Switch
                                                checked={noteForm.pinned}
                                                onChange={(event) => setNoteForm((current) => ({ ...current, pinned: event.target.checked }))}
                                            />
                                        </Stack>
                                    </Stack>

                                    <Alert
                                        severity="warning"
                                        icon={<WarningAmber />}
                                        sx={{
                                            bgcolor: "rgba(255,200,87,0.12)",
                                            color: "grey.50",
                                            border: "1px solid rgba(255,200,87,0.30)",
                                            "& .MuiAlert-icon": { color: "#FFC857" },
                                        }}
                                    >
                                        <AlertTitle sx={{ color: "grey.50", fontWeight: 900 }}>Do not store secrets</AlertTitle>
                                        Do not store passwords, API keys, tokens, recovery codes, private keys, or other secrets.
                                    </Alert>

                                    <TextField
                                        label="Title (optional)"
                                        value={noteForm.title}
                                        onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))}
                                        slotProps={{ htmlInput: { maxLength: 160 } }}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.commands)}
                                    />
                                    <TextField
                                        label="Note"
                                        value={noteForm.body}
                                        onChange={(event) => setNoteForm((current) => ({ ...current, body: event.target.value }))}
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
                                            onClick={() => void submitNoteForm()}
                                            sx={primaryActionButtonSx(dashboardAccents.commands)}
                                        >
                                            {editingNote ? "Save changes" : "Save note"}
                                        </Button>
                                        {editingNote && (
                                            <Button
                                                variant="outlined"
                                                onClick={resetNoteForm}
                                                sx={ghostActionButtonSx(dashboardAccents.commands)}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </Stack>
                                </Stack>
                            </FeaturePanel>

                            <FeaturePanel accent={dashboardAccents.quotes}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                Notes
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {noteQuery.trim() ? `${filteredNotes.length} of ${notes.length} shown` : `${notes.length} saved`}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            value={noteQuery}
                                            onChange={(event) => setNoteQuery(event.target.value)}
                                            placeholder="Search notes"
                                            size="small"
                                            sx={{ width: { xs: "100%", md: 280 }, ...dashboardFieldSx(dashboardAccents.quotes) }}
                                            slotProps={{
                                                input: {
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Search fontSize="small" sx={{ color: "rgba(255,255,255,0.58)" }} />
                                                        </InputAdornment>
                                                    ),
                                                },
                                            }}
                                        />
                                    </Stack>

                                    {notes.length === 0 ? (
                                        <EmptyPersonalState icon={<NoteAlt />} title="No notes yet" accent={dashboardAccents.commands} />
                                    ) : filteredNotes.length === 0 ? (
                                        <EmptyPersonalState icon={<Search />} title="No matching notes" accent={dashboardAccents.quotes} />
                                    ) : (
                                        <Stack spacing={1.5}>
                                            {filteredNotes.map((note) => (
                                                <NoteCard
                                                    key={note.id}
                                                    note={note}
                                                    onTogglePinned={togglePinned}
                                                    onEdit={startEdit}
                                                    onDelete={removeNote}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            </FeaturePanel>
                        </Stack>

                        <Stack spacing={3} sx={{ minWidth: 0 }}>
                            <FeaturePanel accent={dashboardAccents.birthdays}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                            Create reminder
                                        </Typography>
                                        <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                            Reminders are sent as direct messages by the bot.
                                        </Typography>
                                    </Stack>
                                    <TextField
                                        label="Reminder"
                                        value={reminderForm.message}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, message: event.target.value }))}
                                        multiline
                                        minRows={3}
                                        slotProps={{ htmlInput: { maxLength: 2000 } }}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.birthdays)}
                                    />
                                    <TextField
                                        label="When"
                                        value={reminderForm.timespan}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, timespan: event.target.value }))}
                                        helperText="Examples: 10m, 1h, 2d"
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.birthdays)}
                                    />
                                    <Button
                                        variant="contained"
                                        startIcon={<AlarmAdd />}
                                        disabled={saving}
                                        onClick={() => void submitReminderForm()}
                                        sx={primaryActionButtonSx(dashboardAccents.birthdays)}
                                    >
                                        Save reminder
                                    </Button>
                                </Stack>
                            </FeaturePanel>

                            <FeaturePanel accent={dashboardAccents.settings}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                User settings
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                Timezone and reminder defaults
                                            </Typography>
                                        </Box>
                                        <ManageAccounts sx={{ color: alpha(dashboardAccents.settings, 0.86) }} />
                                    </Stack>
                                    <TextField
                                        label="Timezone"
                                        value={settingsForm.timezone}
                                        onChange={(event) => setSettingsForm((current) => ({ ...current, timezone: event.target.value }))}
                                        placeholder="Europe/Amsterdam"
                                        helperText={`Current: ${settings?.timezone ?? "Not set"}`}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.settings)}
                                    />
                                    <TextField
                                        label="Default reminder interval"
                                        value={settingsForm.defaultReminderTimeSpan}
                                        onChange={(event) => setSettingsForm((current) => ({ ...current, defaultReminderTimeSpan: event.target.value }))}
                                        placeholder="1h"
                                        helperText={`Current: ${settings?.defaultReminderTimeSpan ?? "Not set"}; examples: 10m, 1h, 2d`}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.settings)}
                                    />
                                    <Button
                                        variant="contained"
                                        startIcon={<Save />}
                                        disabled={saving}
                                        onClick={() => void submitSettingsForm()}
                                        sx={primaryActionButtonSx(dashboardAccents.settings)}
                                    >
                                        Save settings
                                    </Button>
                                </Stack>
                            </FeaturePanel>

                            <FeaturePanel accent={dashboardAccents.birthdays}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                Reminders
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {reminders.length} pending
                                            </Typography>
                                        </Box>
                                        <NotificationsActive sx={{ color: alpha(dashboardAccents.birthdays, 0.86) }} />
                                    </Stack>
                                    {reminders.length === 0 ? (
                                        <EmptyPersonalState icon={<Schedule />} title="No reminders pending" accent={dashboardAccents.birthdays} />
                                    ) : (
                                        <Stack spacing={1.5}>
                                            {reminders.map((reminder) => (
                                                <ReminderCard
                                                    key={reminder.id}
                                                    reminder={reminder}
                                                    saving={saving}
                                                    onSnooze={snoozeReminderBy}
                                                    onDelete={removeReminder}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            </FeaturePanel>

                            <FeaturePanel accent={dashboardAccents.anime}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                Anime DM subscriptions
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {animeSubscriptions.length} personal reminders
                                            </Typography>
                                        </Box>
                                        <Movie sx={{ color: alpha(dashboardAccents.anime, 0.86) }} />
                                    </Stack>
                                    {animeSubscriptions.length === 0 ? (
                                        <EmptyPersonalState icon={<Movie />} title="No anime DM subscriptions" accent={dashboardAccents.anime} />
                                    ) : (
                                        <Stack spacing={1.5}>
                                            {animeSubscriptions.map((subscription) => (
                                                <AnimeSubscriptionCard
                                                    key={subscription.id ?? subscription.anilistId}
                                                    subscription={subscription}
                                                    saving={saving}
                                                    onTogglePaused={toggleAnimePaused}
                                                    onDelete={removeAnimeSubscription}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            </FeaturePanel>

                            <FeaturePanel accent={dashboardAccents.settings}>
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
                                        body={`${reminders.length} pending`}
                                        accent={dashboardAccents.birthdays}
                                    />
                                    <PersonalFeatureRow
                                        icon={<Movie />}
                                        title="Anime"
                                        body={`${animeSubscriptions.length} DM subscriptions`}
                                        accent={dashboardAccents.anime}
                                    />
                                    <PersonalFeatureRow
                                        icon={<ManageAccounts />}
                                        title="Settings"
                                        body={`Timezone ${settings?.timezone ?? "not set"}; reminders ${settings?.defaultReminderTimeSpan ?? "not set"}`}
                                        accent={dashboardAccents.settings}
                                    />
                                </Stack>
                            </FeaturePanel>
                        </Stack>
                    </Box>
                </Stack>
            </FeatureShell>
        </DashboardLayout>
    );
}

function AnimeSubscriptionCard({ subscription, saving, onTogglePaused, onDelete }: {
    subscription: AnimeSubscriptionDashboardConfig;
    saving: boolean;
    onTogglePaused: (subscription: AnimeSubscriptionDashboardConfig) => void | Promise<unknown>;
    onDelete: (subscription: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
}) {
    const paused = Boolean(subscription.paused);

    return (
        <Box sx={{ ...dashboardCardSx(dashboardAccents.anime), p: 2 }}>
            <Stack spacing={1.5} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere" }}>
                            {subscriptionTitle(subscription)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.5 }}>
                            {subscriptionMeta(subscription)}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                            <Chip
                                label={`AniList #${subscription.anilistId}`}
                                size="small"
                                variant="outlined"
                                sx={{ color: "rgba(255,255,255,0.68)", borderColor: "rgba(255,255,255,0.16)" }}
                            />
                            {paused && (
                                <Chip
                                    label="Paused"
                                    size="small"
                                    sx={{ bgcolor: "rgba(104,215,255,0.14)", color: "grey.50" }}
                                />
                            )}
                        </Stack>
                    </Box>
                    <Tooltip title="Delete">
                        <IconButton aria-label="Delete anime subscription" onClick={() => void onDelete(subscription)} disabled={saving} sx={{ color: dashboardAccents.quotes }}>
                            <Delete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Button
                    size="small"
                    variant="outlined"
                    disabled={saving || !subscription.id}
                    onClick={() => void onTogglePaused(subscription)}
                    sx={ghostActionButtonSx(dashboardAccents.anime)}
                >
                    {paused ? "Resume reminders" : "Pause reminders"}
                </Button>
            </Stack>
        </Box>
    );
}

function NoteCard({ note, onTogglePinned, onEdit, onDelete }: {
    note: UserNote;
    onTogglePinned: (note: UserNote) => void | Promise<void>;
    onEdit: (note: UserNote) => void;
    onDelete: (note: UserNote) => void | Promise<void>;
}) {
    return (
        <Box sx={{ ...dashboardCardSx(note.pinned ? dashboardAccents.commands : dashboardAccents.quotes), p: 2.25 }}>
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
                                onClick={() => void onTogglePinned(note)}
                                sx={{ color: note.pinned ? dashboardAccents.commands : "grey.300" }}
                            >
                                <PushPin fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                            <IconButton aria-label="Edit note" onClick={() => onEdit(note)} sx={{ color: "grey.300" }}>
                                <Edit fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton aria-label="Delete note" onClick={() => void onDelete(note)} sx={{ color: dashboardAccents.quotes }}>
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
    );
}

function ReminderCard({ reminder, saving, onSnooze, onDelete }: {
    reminder: UserReminder;
    saving: boolean;
    onSnooze: (reminder: UserReminder, timespan: string) => void | Promise<void>;
    onDelete: (reminder: UserReminder) => void | Promise<void>;
}) {
    const due = reminder.timestamp <= Date.now();

    return (
        <Box sx={{ ...dashboardCardSx(dashboardAccents.birthdays), p: 2 }}>
            <Stack spacing={1.5} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                            {reminder.message}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.75, flexWrap: "wrap", rowGap: 0.75 }}>
                            <Chip
                                icon={<AccessTime fontSize="small" />}
                                label={formatReminderRelative(reminder.timestamp)}
                                size="small"
                                sx={{
                                    bgcolor: due ? "rgba(255,107,154,0.16)" : alpha(dashboardAccents.birthdays, 0.16),
                                    color: "grey.50",
                                }}
                            />
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                                {formatDateTime(reminder.timestamp)}
                            </Typography>
                        </Stack>
                    </Box>
                    <Tooltip title="Delete">
                        <IconButton aria-label="Delete reminder" onClick={() => void onDelete(reminder)} disabled={saving} sx={{ color: dashboardAccents.quotes }}>
                            <Delete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                    {["10m", "1h", "1d"].map((timespan) => (
                        <Button
                            key={timespan}
                            size="small"
                            variant="outlined"
                            disabled={saving}
                            onClick={() => void onSnooze(reminder, timespan)}
                            sx={ghostActionButtonSx(dashboardAccents.birthdays)}
                        >
                            Snooze {timespan}
                        </Button>
                    ))}
                </Stack>
            </Stack>
        </Box>
    );
}

function EmptyPersonalState({ icon, title, accent }: { icon: React.ReactNode; title: string; accent: string }) {
    return (
        <Box sx={{ py: 5, textAlign: "center", color: "rgba(255,255,255,0.58)" }}>
            <Box sx={{ display: "inline-grid", placeItems: "center", color: alpha(accent, 0.78), mb: 1, "& svg": { fontSize: 42 } }}>
                {icon}
            </Box>
            <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
        </Box>
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

function formatDateTime(value: number): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "unknown time";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatReminderRelative(timestamp: number): string {
    const diffMs = timestamp - Date.now();
    if (diffMs <= 0) return "Due now";

    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 1) return "In under 1m";
    if (minutes < 60) return `In ${minutes}m`;

    const hours = Math.round(minutes / 60);
    if (hours < 48) return `In ${hours}h`;

    const days = Math.round(hours / 24);
    return `In ${days}d`;
}
