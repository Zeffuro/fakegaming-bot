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
    MenuItem,
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
    PauseCircle,
    PlayArrow,
    Refresh,
    Save,
    Schedule,
    Search,
    SportsEsports,
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
import { useMyRiotLink } from "@/components/hooks/useMyRiotLink";
import { useUserAnimeSubscriptions } from "@/components/hooks/useUserAnimeSubscriptions";
import { useUserActivity } from "@/components/hooks/useUserActivity";
import { useUserDigestSubscription } from "@/components/hooks/useUserDigestSubscription";
import { useUserNotes } from "@/components/hooks/useUserNotes";
import { useUserReminders } from "@/components/hooks/useUserReminders";
import { useUserSettings } from "@/components/hooks/useUserSettings";
import type { AnimeSubscriptionDashboardConfig, UserDigestCategory, UserDigestFrequency, UserNote, UserReminder, UserSettingsUpdateInput } from "@/lib/api-client";
import { buildPersonalRiotSummary, type PersonalRiotSummary, type PersonalRiotSummaryTone } from "@/lib/personalRiotSummary";
import {
    buildPersonalSubscriptionOverview,
    type PersonalSubscriptionOverview,
    type PersonalSubscriptionOverviewItem,
} from "@/lib/personalSubscriptionOverview";
import { buildUserActivityFeed, type UserActivityFeedItem } from "@/lib/userActivityFeed";

const emptyNoteForm = {
    title: "",
    body: "",
    pinned: false,
};

const emptyReminderForm = {
    message: "",
    timespan: "1h",
    recurrence: "",
    recurrenceTimezone: "",
};

const emptySettingsForm = {
    timezone: "",
    defaultReminderTimeSpan: "",
};

const emptyDigestForm = {
    frequency: "daily" as UserDigestFrequency,
    timezone: "",
    runAt: "09:00",
    dayOfWeek: "1",
    includeReminders: true,
    includeAnime: false,
};

const weekdayOptions = [
    { value: "0", label: "Sunday" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
];

type NoteFormState = typeof emptyNoteForm;
type ReminderFormState = typeof emptyReminderForm;
type SettingsFormState = typeof emptySettingsForm;
type DigestFormState = typeof emptyDigestForm;

export default function PersonalDashboardPage() {
    const { notes, loading: notesLoading, saving: notesSaving, error: notesError, createNote, updateNote, deleteNote } = useUserNotes();
    const {
        reminders,
        loading: remindersLoading,
        saving: remindersSaving,
        error: remindersError,
        createReminder,
        snoozeReminder,
        setReminderPaused,
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
    const {
        subscription: digestSubscription,
        loading: digestLoading,
        saving: digestSaving,
        error: digestError,
        saveSubscription: saveDigestSubscription,
        setPaused: setDigestPaused,
    } = useUserDigestSubscription();
    const {
        activity,
        loading: activityLoading,
        error: activityError,
        refresh: refreshActivity,
    } = useUserActivity();
    const {
        link: riotLink,
        loading: riotLoading,
        error: riotError,
        refresh: refreshRiotLink,
    } = useMyRiotLink();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [noteForm, setNoteForm] = useState<NoteFormState>(emptyNoteForm);
    const [reminderForm, setReminderForm] = useState<ReminderFormState>(emptyReminderForm);
    const [settingsForm, setSettingsForm] = useState<SettingsFormState>(emptySettingsForm);
    const [digestForm, setDigestForm] = useState<DigestFormState>(emptyDigestForm);
    const [noteQuery, setNoteQuery] = useState("");
    const [noteLocalError, setNoteLocalError] = useState<string | null>(null);
    const [reminderLocalError, setReminderLocalError] = useState<string | null>(null);
    const [settingsLocalError, setSettingsLocalError] = useState<string | null>(null);
    const [digestLocalError, setDigestLocalError] = useState<string | null>(null);

    useEffect(() => {
        setSettingsForm({
            timezone: settings?.timezone ?? "",
            defaultReminderTimeSpan: settings?.defaultReminderTimeSpan ?? "",
        });
    }, [settings]);

    useEffect(() => {
        setDigestForm({
            frequency: digestSubscription?.frequency ?? "daily",
            timezone: digestSubscription?.timezone ?? settings?.timezone ?? "",
            runAt: digestSubscription?.runAt ?? "09:00",
            dayOfWeek: String(digestSubscription?.dayOfWeek ?? 1),
            includeReminders: digestSubscription?.categories.includes("reminders") ?? true,
            includeAnime: digestSubscription?.categories.includes("anime") ?? false,
        });
    }, [digestSubscription, settings?.timezone]);

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

    const pageError = noteLocalError ?? reminderLocalError ?? settingsLocalError ?? digestLocalError ?? notesError ?? remindersError ?? animeError ?? settingsError ?? digestError ?? activityError ?? riotError;
    const loading = notesLoading || remindersLoading || animeLoading || settingsLoading || digestLoading || activityLoading || riotLoading;
    const saving = notesSaving || remindersSaving || animeSaving || settingsSaving || digestSaving;
    const pausedReminderCount = reminders.filter(isPausedRecurringReminder).length;
    const activeReminderCount = reminders.length - pausedReminderCount;
    const digestStatus = digestSubscription ? (digestSubscription.paused ? "paused" : "active") : "off";
    const riotSummary = useMemo(
        () => buildPersonalRiotSummary(riotLink, formatDate),
        [riotLink],
    );
    const subscriptionOverview = useMemo(
        () => buildPersonalSubscriptionOverview({
            reminders,
            animeSubscriptions,
            digestSubscription,
            settings,
            formatDateTime,
        }),
        [animeSubscriptions, digestSubscription, reminders, settings],
    );
    const activityFeed = useMemo(() => buildUserActivityFeed({
        auditEvents: activity?.auditEvents ?? [],
        deliveries: activity?.deliveries ?? [],
        limit: 8,
    }), [activity]);

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
            const recurrence = reminderForm.recurrence.trim();
            const recurrenceTimezone = reminderForm.recurrenceTimezone.trim() || settings?.timezone?.trim() || "";
            if (recurrence && !recurrenceTimezone) {
                setReminderLocalError("Add a timezone for recurring reminders, such as Europe/Amsterdam.");
                return;
            }

            await createReminder({
                message,
                timespan,
                ...(recurrence ? { recurrence, recurrenceTimezone } : {}),
            });
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

    const submitDigestForm = async () => {
        const timezone = digestForm.timezone.trim();
        const runAt = digestForm.runAt.trim();
        const frequency = digestForm.frequency === "weekly" ? "weekly" : "daily";
        if (!timezone) {
            setDigestLocalError("Add a timezone for digest delivery.");
            return;
        }
        if (!runAt) {
            setDigestLocalError("Add a digest delivery time.");
            return;
        }
        if (!digestForm.includeReminders && !digestForm.includeAnime) {
            setDigestLocalError("Select at least one digest category.");
            return;
        }

        try {
            const categories: UserDigestCategory[] = [
                ...(digestForm.includeReminders ? ["reminders" as const] : []),
                ...(digestForm.includeAnime ? ["anime" as const] : []),
            ];
            await saveDigestSubscription({
                frequency,
                timezone,
                runAt,
                dayOfWeek: frequency === "weekly" ? Number(digestForm.dayOfWeek) : null,
                categories,
                paused: digestSubscription?.paused ?? false,
            });
            setDigestLocalError(null);
        } catch {
            // Hook exposes the error state.
        }
    };

    const toggleDigestPaused = async () => {
        if (!digestSubscription) {
            setDigestLocalError("Save a digest schedule before pausing it.");
            return;
        }

        try {
            await setDigestPaused({ paused: !digestSubscription.paused });
            setDigestLocalError(null);
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

    const toggleReminderPaused = async (reminder: UserReminder) => {
        try {
            await setReminderPaused(reminder.id, { paused: !reminder.completed });
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
                        { label: "reminders", value: activeReminderCount },
                        { label: "anime subs", value: animeSubscriptions.length },
                        { label: "digest", value: digestStatus },
                        { label: "Riot link", value: riotSummary.linked ? "linked" : "none" },
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

                            <FeaturePanel accent={dashboardAccents.birthdays}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                Reminders
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {pausedReminderCount > 0 ? `${activeReminderCount} active, ${pausedReminderCount} paused` : `${activeReminderCount} active`}
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
                                                    onTogglePaused={toggleReminderPaused}
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
                                    <TextField
                                        label="Repeat (optional)"
                                        value={reminderForm.recurrence}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, recurrence: event.target.value }))}
                                        helperText="Examples: daily, weekly, monthly, every 2 weeks"
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.birthdays)}
                                    />
                                    <TextField
                                        label="Repeat timezone"
                                        value={reminderForm.recurrenceTimezone}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, recurrenceTimezone: event.target.value }))}
                                        placeholder={settings?.timezone ?? "Europe/Amsterdam"}
                                        helperText={settings?.timezone ? `Defaults to ${settings.timezone}` : "Required when Repeat is set"}
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

                            <PersonalSubscriptionOverviewPanel overview={subscriptionOverview} />

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

                            <FeaturePanel accent={dashboardAccents.settings}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                Personal digest
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {formatDigestStatus(digestStatus)}
                                            </Typography>
                                        </Box>
                                        <NotificationsActive sx={{ color: alpha(dashboardAccents.settings, 0.86) }} />
                                    </Stack>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                                        <Chip
                                            label={formatDigestStatus(digestStatus)}
                                            size="small"
                                            sx={{
                                                bgcolor: digestStatus === "active" ? alpha(dashboardAccents.settings, 0.16) : "rgba(255,255,255,0.08)",
                                                color: "grey.50",
                                            }}
                                        />
                                        {digestSubscription?.nextRunAt ? (
                                            <Chip
                                                label={`Next: ${formatDateTime(digestSubscription.nextRunAt)}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ color: "rgba(255,255,255,0.72)", borderColor: "rgba(255,255,255,0.16)" }}
                                            />
                                        ) : null}
                                        {digestSubscription?.lastSentAt ? (
                                            <Chip
                                                label={`Last sent: ${formatDateTime(digestSubscription.lastSentAt)}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ color: "rgba(255,255,255,0.72)", borderColor: "rgba(255,255,255,0.16)" }}
                                            />
                                        ) : null}
                                    </Stack>
                                    <TextField
                                        select
                                        label="Frequency"
                                        value={digestForm.frequency}
                                        onChange={(event) => setDigestForm((current) => ({ ...current, frequency: event.target.value === "weekly" ? "weekly" : "daily" }))}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.settings)}
                                    >
                                        <MenuItem value="daily">Daily</MenuItem>
                                        <MenuItem value="weekly">Weekly</MenuItem>
                                    </TextField>
                                    {digestForm.frequency === "weekly" ? (
                                        <TextField
                                            select
                                            label="Weekday"
                                            value={digestForm.dayOfWeek}
                                            onChange={(event) => setDigestForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                                            fullWidth
                                            sx={dashboardFieldSx(dashboardAccents.settings)}
                                        >
                                            {weekdayOptions.map((option) => (
                                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                            ))}
                                        </TextField>
                                    ) : null}
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                        <TextField
                                            label="Delivery time"
                                            value={digestForm.runAt}
                                            onChange={(event) => setDigestForm((current) => ({ ...current, runAt: event.target.value }))}
                                            placeholder="09:00"
                                            fullWidth
                                            sx={dashboardFieldSx(dashboardAccents.settings)}
                                        />
                                        <TextField
                                            label="Timezone"
                                            value={digestForm.timezone}
                                            onChange={(event) => setDigestForm((current) => ({ ...current, timezone: event.target.value }))}
                                            placeholder={settings?.timezone ?? "Europe/Amsterdam"}
                                            fullWidth
                                            sx={dashboardFieldSx(dashboardAccents.settings)}
                                        />
                                    </Stack>
                                    <Stack spacing={1.25}>
                                        <Typography sx={{ color: "grey.300", fontWeight: 800 }}>Digest categories</Typography>
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                            <DigestCategoryToggle
                                                label="Reminders"
                                                checked={digestForm.includeReminders}
                                                accent={dashboardAccents.birthdays}
                                                onChange={(checked) => setDigestForm((current) => ({ ...current, includeReminders: checked }))}
                                            />
                                            <DigestCategoryToggle
                                                label="Anime"
                                                checked={digestForm.includeAnime}
                                                accent={dashboardAccents.anime}
                                                onChange={(checked) => setDigestForm((current) => ({ ...current, includeAnime: checked }))}
                                            />
                                        </Stack>
                                    </Stack>
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                        <Button
                                            variant="contained"
                                            startIcon={<Save />}
                                            disabled={saving}
                                            onClick={() => void submitDigestForm()}
                                            sx={primaryActionButtonSx(dashboardAccents.settings)}
                                        >
                                            Save digest
                                        </Button>
                                        {digestSubscription ? (
                                            <Button
                                                variant="outlined"
                                                startIcon={digestSubscription.paused ? <PlayArrow /> : <PauseCircle />}
                                                disabled={saving}
                                                onClick={() => void toggleDigestPaused()}
                                                sx={ghostActionButtonSx(dashboardAccents.settings)}
                                            >
                                                {digestSubscription.paused ? "Resume" : "Pause"}
                                            </Button>
                                        ) : null}
                                    </Stack>
                                </Stack>
                            </FeaturePanel>

                            <RiotLinkPanel summary={riotSummary} loading={riotLoading} onRefresh={refreshRiotLink} />

                            <UserActivityPanel
                                items={activityFeed}
                                auditTotal={activity?.summary.auditTotal ?? 0}
                                deliveryTotal={activity?.summary.deliveryTotal ?? 0}
                                loading={activityLoading}
                                onRefresh={refreshActivity}
                            />

                        </Stack>
                    </Box>
                </Stack>
            </FeatureShell>
        </DashboardLayout>
    );
}

function RiotLinkPanel({ summary, loading, onRefresh }: {
    summary: PersonalRiotSummary;
    loading: boolean;
    onRefresh: () => void | Promise<void>;
}) {
    return (
        <FeaturePanel accent={dashboardAccents.patchNotes}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            Riot linked account
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                            {summary.helperText}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Chip
                            label={summary.badgeLabel}
                            size="small"
                            sx={{
                                bgcolor: alpha(summary.linked ? dashboardAccents.settings : dashboardAccents.neutral, 0.16),
                                color: "grey.50",
                            }}
                        />
                        <Tooltip title="Refresh Riot link">
                            <IconButton
                                aria-label="Refresh Riot linked account"
                                disabled={loading}
                                onClick={() => void onRefresh()}
                                sx={{ color: alpha(dashboardAccents.patchNotes, 0.86) }}
                            >
                                <Refresh fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>

                {summary.linked ? (
                    <Stack spacing={1.25}>
                        {summary.rows.map((row) => (
                            <RiotLinkInfoRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
                        ))}
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", overflowWrap: "anywhere" }}>
                            Account changes are handled through the existing Riot link flows.
                        </Typography>
                    </Stack>
                ) : (
                    <EmptyPersonalState icon={<SportsEsports />} title={summary.summaryText} accent={dashboardAccents.patchNotes} />
                )}
            </Stack>
        </FeaturePanel>
    );
}

function PersonalSubscriptionOverviewPanel({ overview }: { overview: PersonalSubscriptionOverview }) {
    return (
        <FeaturePanel accent={dashboardAccents.settings}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            Subscription overview
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                            {overview.summary}
                        </Typography>
                    </Box>
                    <NotificationsActive sx={{ color: alpha(dashboardAccents.settings, 0.86) }} />
                </Stack>

                <Stack spacing={1.25}>
                    {overview.items.map((item) => (
                        <PersonalSubscriptionOverviewCard key={item.id} item={item} />
                    ))}
                </Stack>
            </Stack>
        </FeaturePanel>
    );
}

function PersonalSubscriptionOverviewCard({ item }: { item: PersonalSubscriptionOverviewItem }) {
    const accent = getSubscriptionOverviewAccent(item);

    return (
        <Box sx={{ ...dashboardCardSx(accent), height: "auto", p: 1.6 }}>
            <Stack spacing={1.1} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
                    <Stack direction="row" spacing={1.2} sx={{ minWidth: 0, alignItems: "flex-start" }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", color: "grey.50", bgcolor: alpha(accent, 0.16), flexShrink: 0 }}>
                            {getSubscriptionOverviewIcon(item)}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere" }}>
                                {item.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.25, overflowWrap: "anywhere" }}>
                                {item.detail}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        label={item.statusLabel}
                        size="small"
                        sx={{ bgcolor: alpha(accent, 0.16), color: "grey.50", flexShrink: 0 }}
                    />
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", overflowWrap: "anywhere" }}>
                    {item.meta}
                </Typography>
            </Stack>
        </Box>
    );
}

function getSubscriptionOverviewIcon(item: PersonalSubscriptionOverviewItem): React.ReactNode {
    if (item.id === "anime") return <Movie fontSize="small" />;
    if (item.id === "digest") return <NotificationsActive fontSize="small" />;
    if (item.id === "preferences") return <ManageAccounts fontSize="small" />;
    return <Schedule fontSize="small" />;
}

function getSubscriptionOverviewAccent(item: PersonalSubscriptionOverviewItem): string {
    if (item.status === "attention") return dashboardAccents.birthdays;
    if (item.id === "anime") return dashboardAccents.anime;
    if (item.id === "reminders") return dashboardAccents.birthdays;
    if (item.id === "digest") return dashboardAccents.settings;
    return dashboardAccents.commands;
}

function UserActivityPanel({
    items,
    auditTotal,
    deliveryTotal,
    loading,
    onRefresh,
}: {
    items: UserActivityFeedItem[];
    auditTotal: number;
    deliveryTotal: number;
    loading: boolean;
    onRefresh: () => void | Promise<void>;
}) {
    const summary = loading
        ? "Loading recent activity"
        : `${auditTotal} account ${auditTotal === 1 ? "event" : "events"}; ${deliveryTotal} birthday ${deliveryTotal === 1 ? "delivery" : "deliveries"}`;

    return (
        <FeaturePanel accent={dashboardAccents.commands}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            Account activity
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                            {summary}
                        </Typography>
                    </Box>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Refresh />}
                        disabled={loading}
                        onClick={() => void onRefresh()}
                        sx={ghostActionButtonSx(dashboardAccents.commands)}
                    >
                        Refresh
                    </Button>
                </Stack>

                {items.length === 0 ? (
                    <EmptyPersonalState icon={<AccessTime />} title={loading ? "Loading activity" : "No activity recorded"} accent={dashboardAccents.commands} />
                ) : (
                    <Stack spacing={1.25}>
                        {items.map(item => <UserActivityCard key={item.id} item={item} />)}
                    </Stack>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function UserActivityCard({ item }: { item: UserActivityFeedItem }) {
    const accent = item.type === "delivery"
        ? dashboardAccents.birthdays
        : item.status === "failure" ? dashboardAccents.quotes : dashboardAccents.commands;
    const label = item.type === "delivery"
        ? "Delivery"
        : item.status === "failure" ? "Failed" : "Audit";

    return (
        <Box sx={{ ...dashboardCardSx(accent), p: 1.75 }}>
            <Stack spacing={1} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere" }}>
                            {item.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.58)", mt: 0.35, overflowWrap: "anywhere" }}>
                            {item.detail}
                        </Typography>
                    </Box>
                    <Chip
                        label={label}
                        size="small"
                        sx={{ bgcolor: alpha(accent, 0.16), color: "grey.50", flexShrink: 0 }}
                    />
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>
                    {formatDate(item.timestamp)}
                </Typography>
            </Stack>
        </Box>
    );
}

function RiotLinkInfoRow({ label, value, tone }: { label: string; value: string; tone: PersonalRiotSummaryTone }) {
    const accent = tone === "success"
        ? dashboardAccents.settings
        : tone === "warning" ? dashboardAccents.birthdays : dashboardAccents.patchNotes;

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                px: 1.5,
                py: 1.2,
                borderRadius: 2,
                bgcolor: alpha(accent, tone === "default" ? 0.045 : 0.10),
                border: `1px solid ${alpha(accent, tone === "default" ? 0.14 : 0.28)}`,
            }}
        >
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800, textAlign: "right", overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
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

function ReminderCard({ reminder, saving, onSnooze, onTogglePaused, onDelete }: {
    reminder: UserReminder;
    saving: boolean;
    onSnooze: (reminder: UserReminder, timespan: string) => void | Promise<void>;
    onTogglePaused: (reminder: UserReminder) => void | Promise<void>;
    onDelete: (reminder: UserReminder) => void | Promise<void>;
}) {
    const recurring = isRecurringReminder(reminder);
    const paused = isPausedRecurringReminder(reminder);
    const nextPreviewAt = reminder.nextPreviewAt ?? reminder.timestamp;
    const due = !paused && reminder.timestamp <= Date.now();

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
                                label={paused ? "Paused" : formatReminderRelative(reminder.timestamp)}
                                size="small"
                                sx={{
                                    bgcolor: paused
                                        ? "rgba(104,215,255,0.14)"
                                        : due ? "rgba(255,107,154,0.16)" : alpha(dashboardAccents.birthdays, 0.16),
                                    color: "grey.50",
                                }}
                            />
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                                {formatDateTime(reminder.timestamp)}
                            </Typography>
                            {reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone ? (
                                <Chip
                                    icon={<Schedule fontSize="small" />}
                                    label={formatReminderRecurrenceLabel(reminder)}
                                    size="small"
                                    sx={{
                                        bgcolor: alpha(dashboardAccents.settings, 0.14),
                                        color: "grey.50",
                                    }}
                                />
                            ) : null}
                            {recurring ? (
                                <Chip
                                    label={`${paused ? "Next after resume" : "Next run"}: ${formatDateTime(nextPreviewAt)}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        color: "rgba(255,255,255,0.72)",
                                        borderColor: "rgba(255,255,255,0.16)",
                                    }}
                                />
                            ) : null}
                        </Stack>
                    </Box>
                    <Tooltip title="Delete">
                        <IconButton aria-label="Delete reminder" onClick={() => void onDelete(reminder)} disabled={saving} sx={{ color: dashboardAccents.quotes }}>
                            <Delete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                    {recurring ? (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={paused ? <PlayArrow /> : <PauseCircle />}
                            disabled={saving}
                            onClick={() => void onTogglePaused(reminder)}
                            sx={ghostActionButtonSx(dashboardAccents.settings)}
                        >
                            {paused ? "Resume" : "Pause"}
                        </Button>
                    ) : null}
                    {["10m", "1h", "1d"].map((timespan) => (
                        <Button
                            key={timespan}
                            size="small"
                            variant="outlined"
                            disabled={saving || paused}
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

function isRecurringReminder(reminder: UserReminder): boolean {
    return Boolean(reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone);
}

function isPausedRecurringReminder(reminder: UserReminder): boolean {
    return reminder.completed && isRecurringReminder(reminder);
}

function formatDigestStatus(status: "active" | "paused" | "off"): string {
    if (status === "active") return "Active";
    if (status === "paused") return "Paused";
    return "Not configured";
}

function DigestCategoryToggle({ label, checked, accent, onChange }: {
    label: string;
    checked: boolean;
    accent: string;
    onChange: (checked: boolean) => void;
}) {
    return (
        <Box
            component="label"
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                minWidth: { sm: 180 },
                px: 1.5,
                py: 1.15,
                borderRadius: 2,
                cursor: "pointer",
                bgcolor: checked ? alpha(accent, 0.14) : "rgba(255,255,255,0.045)",
                border: `1px solid ${checked ? alpha(accent, 0.34) : "rgba(255,255,255,0.08)"}`,
            }}
        >
            <Typography sx={{ color: "grey.50", fontWeight: 800 }}>{label}</Typography>
            <Switch
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
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

function formatReminderRecurrenceLabel(reminder: UserReminder): string {
    if (!reminder.recurrenceUnit || !reminder.recurrenceInterval || !reminder.recurrenceTimezone) return "One-off";
    const unit = reminder.recurrenceInterval === 1 ? reminder.recurrenceUnit : `${reminder.recurrenceUnit}s`;
    const cadence = reminder.recurrenceInterval === 1 ? `Every ${reminder.recurrenceUnit}` : `Every ${reminder.recurrenceInterval} ${unit}`;
    return `${cadence} - ${reminder.recurrenceTimezone}`;
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
