"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    AlertTitle,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
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
import { AnimeMediaRow } from "@/components/anime/AnimeMediaRow";
import { canSubscribe, errorMessage, formatAnimeTitle, formatStatus, subscriptionMeta, subscriptionTitle } from "@/components/anime/animeUtils";
import { useMyRiotLink } from "@/components/hooks/useMyRiotLink";
import { useUserAnimeSubscriptions } from "@/components/hooks/useUserAnimeSubscriptions";
import { useUserActivity } from "@/components/hooks/useUserActivity";
import { useUserDigestSubscription } from "@/components/hooks/useUserDigestSubscription";
import { useUserNotes } from "@/components/hooks/useUserNotes";
import { useUserReminders } from "@/components/hooks/useUserReminders";
import { useUserSettings } from "@/components/hooks/useUserSettings";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { api, type AnimeSearchResult, type AnimeSubscriptionDashboardConfig, type UserDigestCategory, type UserDigestFrequency, type UserNote, type UserReminder, type UserSettingsUpdateInput } from "@/lib/api-client";
import type { DashboardMessageKey, DashboardTranslator } from "@/lib/i18n/messages";
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
    { value: "0", labelKey: "personal.weekdaySunday" },
    { value: "1", labelKey: "personal.weekdayMonday" },
    { value: "2", labelKey: "personal.weekdayTuesday" },
    { value: "3", labelKey: "personal.weekdayWednesday" },
    { value: "4", labelKey: "personal.weekdayThursday" },
    { value: "5", labelKey: "personal.weekdayFriday" },
    { value: "6", labelKey: "personal.weekdaySaturday" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: DashboardMessageKey }>;

type NoteFormState = typeof emptyNoteForm;
type ReminderFormState = typeof emptyReminderForm;
type SettingsFormState = typeof emptySettingsForm;
type DigestFormState = typeof emptyDigestForm;

export default function PersonalDashboardPage() {
    const { t, formatDate, formatNumber } = useDashboardI18n();
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
        createSubscription: createAnimeSubscription,
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
    const formatDateValue = useCallback((value: string | number | null): string => {
        if (value === null || value === "") return t("common.unknown");
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : t("personal.unknownTime");
        return formatDate(date, { dateStyle: "medium", timeStyle: "short" });
    }, [formatDate, t]);

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
        () => buildPersonalRiotSummary(riotLink, value => formatDateValue(value), t),
        [formatDateValue, riotLink, t],
    );
    const subscriptionOverview = useMemo(
        () => buildPersonalSubscriptionOverview({
            reminders,
            animeSubscriptions,
            digestSubscription,
            settings,
            formatDateTime: formatDateValue,
            formatNumber,
            t,
        }),
        [animeSubscriptions, digestSubscription, formatDateValue, formatNumber, reminders, settings, t],
    );
    const activityFeed = useMemo(() => buildUserActivityFeed({
        auditEvents: activity?.auditEvents ?? [],
        deliveries: activity?.deliveries ?? [],
        limit: 8,
        t,
    }), [activity, t]);

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
            setNoteLocalError(t("personal.noteRequired"));
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
            setReminderLocalError(t("personal.reminderMessageRequired"));
            return;
        }
        if (!timespan) {
            setReminderLocalError(t("personal.reminderTimeRequired"));
            return;
        }

        try {
            const recurrence = reminderForm.recurrence.trim();
            const recurrenceTimezone = reminderForm.recurrenceTimezone.trim() || settings?.timezone?.trim() || "";
            if (recurrence && !recurrenceTimezone) {
                setReminderLocalError(t("personal.reminderTimezoneValidation"));
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
            setSettingsLocalError(t("personal.settingsValidation"));
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
            setDigestLocalError(t("personal.digestTimezoneValidation"));
            return;
        }
        if (!runAt) {
            setDigestLocalError(t("personal.digestTimeValidation"));
            return;
        }
        if (!digestForm.includeReminders && !digestForm.includeAnime) {
            setDigestLocalError(t("personal.digestCategoryValidation"));
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
            setDigestLocalError(t("personal.digestScheduleValidation"));
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
        if (!window.confirm(t("personal.deleteNoteConfirmation", { title: note.title }))) return;
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
        if (!window.confirm(t("personal.deleteReminderConfirmation", { message: reminder.message }))) return;
        try {
            await deleteReminder(reminder.id);
        } catch {
            // Hook exposes the error state.
        }
    };

    const removeAnimeSubscription = async (subscription: AnimeSubscriptionDashboardConfig) => {
        if (!window.confirm(t("anime.removePersonalSubscriptionConfirmation", { title: subscriptionTitle(subscription) }))) return;
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
            currentTrail={[{ label: t("personal.title"), href: null, icon: <NoteAlt sx={{ fontSize: 16 }} /> }]}
        >
            <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.birthdays}>
                <FeatureHero
                    icon={<NoteAlt />}
                    eyebrow={t("personal.eyebrow")}
                    title={t("personal.title")}
                    description={t("personal.description")}
                    accent={dashboardAccents.commands}
                    secondaryAccent={dashboardAccents.birthdays}
                    stats={[
                        { label: t("personal.statNotes"), value: formatNumber(notes.length) },
                        { label: t("personal.statPinned"), value: formatNumber(notes.filter((note) => note.pinned).length) },
                        { label: t("personal.statReminders"), value: formatNumber(activeReminderCount) },
                        { label: t("anime.personalSubscriptionStat"), value: formatNumber(animeSubscriptions.length) },
                        { label: t("personal.statDigest"), value: formatDigestStatus(digestStatus, t) },
                        { label: t("personal.statRiotLink"), value: riotSummary.linked ? t("personal.linked") : t("personal.none") },
                    ]}
                    actions={(
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={resetNoteForm}
                            sx={primaryActionButtonSx(dashboardAccents.commands)}
                        >
                            {t("personal.newNote")}
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
                                                {editingNote ? t("personal.editNote") : t("personal.createNote")}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.62)", mt: 0.5 }}>
                                                {t("personal.noteFormDescription")}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                                            <Typography sx={{ color: "grey.300", fontWeight: 700 }}>{t("personal.pinned")}</Typography>
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
                                        <AlertTitle sx={{ color: "grey.50", fontWeight: 900 }}>{t("personal.secretWarningTitle")}</AlertTitle>
                                        {t("personal.secretWarningBody")}
                                    </Alert>

                                    <TextField
                                        label={t("personal.titleOptional")}
                                        value={noteForm.title}
                                        onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))}
                                        slotProps={{ htmlInput: { maxLength: 160 } }}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.commands)}
                                    />
                                    <TextField
                                        label={t("personal.noteLabel")}
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
                                            {editingNote ? t("personal.saveChanges") : t("personal.saveNote")}
                                        </Button>
                                        {editingNote && (
                                            <Button
                                                variant="outlined"
                                                onClick={resetNoteForm}
                                                sx={ghostActionButtonSx(dashboardAccents.commands)}
                                            >
                                                {t("common.cancel")}
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
                                                {t("personal.notesTitle")}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {noteQuery.trim()
                                                    ? t("personal.notesFiltered", { shown: formatNumber(filteredNotes.length), total: formatNumber(notes.length) })
                                                    : t("personal.notesSaved", { count: formatNumber(notes.length) })}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            value={noteQuery}
                                            onChange={(event) => setNoteQuery(event.target.value)}
                                            placeholder={t("personal.searchNotes")}
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
                                        <EmptyPersonalState icon={<NoteAlt />} title={t("personal.noNotes")} accent={dashboardAccents.commands} />
                                    ) : filteredNotes.length === 0 ? (
                                        <EmptyPersonalState icon={<Search />} title={t("personal.noMatchingNotes")} accent={dashboardAccents.quotes} />
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
                                                {t("personal.remindersTitle")}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {pausedReminderCount > 0
                                                    ? t("personal.remindersSummary", { active: formatNumber(activeReminderCount), paused: formatNumber(pausedReminderCount) })
                                                    : t("personal.remindersActive", { count: formatNumber(activeReminderCount) })}
                                            </Typography>
                                        </Box>
                                        <NotificationsActive sx={{ color: alpha(dashboardAccents.birthdays, 0.86) }} />
                                    </Stack>
                                    {reminders.length === 0 ? (
                                        <EmptyPersonalState icon={<Schedule />} title={t("personal.noReminders")} accent={dashboardAccents.birthdays} />
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
                                                {t("anime.personalDashboardSubscriptionsTitle")}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {t("anime.personalReminders", { count: formatNumber(animeSubscriptions.length) })}
                                            </Typography>
                                        </Box>
                                        <Movie sx={{ color: alpha(dashboardAccents.anime, 0.86) }} />
                                    </Stack>
                                    <PersonalAnimeSubscribeForm
                                        saving={animeSaving}
                                        onSubscribe={createAnimeSubscription}
                                    />
                                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                                    {animeSubscriptions.length === 0 ? (
                                        <EmptyPersonalState icon={<Movie />} title={t("anime.noPersonalDmSubscriptions")} accent={dashboardAccents.anime} />
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
                                            {t("personal.createReminder")}
                                        </Typography>
                                        <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                            {t("personal.reminderDmDescription")}
                                        </Typography>
                                    </Stack>
                                    <TextField
                                        label={t("personal.reminderLabel")}
                                        value={reminderForm.message}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, message: event.target.value }))}
                                        multiline
                                        minRows={3}
                                        slotProps={{ htmlInput: { maxLength: 2000 } }}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.birthdays)}
                                    />
                                    <TextField
                                        label={t("personal.when")}
                                        value={reminderForm.timespan}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, timespan: event.target.value }))}
                                        helperText={t("personal.timespanExamples")}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.birthdays)}
                                    />
                                    <TextField
                                        label={t("personal.repeatOptional")}
                                        value={reminderForm.recurrence}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, recurrence: event.target.value }))}
                                        helperText={t("personal.repeatExamples")}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.birthdays)}
                                    />
                                    <TextField
                                        label={t("personal.repeatTimezone")}
                                        value={reminderForm.recurrenceTimezone}
                                        onChange={(event) => setReminderForm((current) => ({ ...current, recurrenceTimezone: event.target.value }))}
                                        placeholder={settings?.timezone ?? "Europe/Amsterdam"}
                                        helperText={settings?.timezone ? t("personal.defaultsTo", { value: settings.timezone }) : t("personal.repeatTimezoneRequired")}
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
                                        {t("personal.saveReminder")}
                                    </Button>
                                </Stack>
                            </FeaturePanel>

                            <PersonalSubscriptionOverviewPanel overview={subscriptionOverview} />

                            <FeaturePanel accent={dashboardAccents.settings}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                {t("personal.settingsTitle")}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {t("personal.settingsDescription")}
                                            </Typography>
                                        </Box>
                                        <ManageAccounts sx={{ color: alpha(dashboardAccents.settings, 0.86) }} />
                                    </Stack>
                                    <TextField
                                        label={t("personal.timezone")}
                                        value={settingsForm.timezone}
                                        onChange={(event) => setSettingsForm((current) => ({ ...current, timezone: event.target.value }))}
                                        placeholder="Europe/Amsterdam"
                                        helperText={t("personal.current", { value: settings?.timezone ?? t("personal.notSet") })}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.settings)}
                                    />
                                    <TextField
                                        label={t("personal.defaultReminderInterval")}
                                        value={settingsForm.defaultReminderTimeSpan}
                                        onChange={(event) => setSettingsForm((current) => ({ ...current, defaultReminderTimeSpan: event.target.value }))}
                                        placeholder="1h"
                                        helperText={t("personal.currentWithExamples", { value: settings?.defaultReminderTimeSpan ?? t("personal.notSet") })}
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
                                        {t("personal.saveSettings")}
                                    </Button>
                                </Stack>
                            </FeaturePanel>

                            <FeaturePanel accent={dashboardAccents.settings}>
                                <Stack spacing={2.25} sx={{ position: "relative" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                                                {t("personal.digestTitle")}
                                            </Typography>
                                            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>
                                                {formatDigestStatus(digestStatus, t)}
                                            </Typography>
                                        </Box>
                                        <NotificationsActive sx={{ color: alpha(dashboardAccents.settings, 0.86) }} />
                                    </Stack>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                                        <Chip
                                            label={formatDigestStatus(digestStatus, t)}
                                            size="small"
                                            sx={{
                                                bgcolor: digestStatus === "active" ? alpha(dashboardAccents.settings, 0.16) : "rgba(255,255,255,0.08)",
                                                color: "grey.50",
                                            }}
                                        />
                                        {digestSubscription?.nextRunAt ? (
                                            <Chip
                                                label={t("personal.next", { date: formatDateValue(digestSubscription.nextRunAt) })}
                                                size="small"
                                                variant="outlined"
                                                sx={{ color: "rgba(255,255,255,0.72)", borderColor: "rgba(255,255,255,0.16)" }}
                                            />
                                        ) : null}
                                        {digestSubscription?.lastSentAt ? (
                                            <Chip
                                                label={t("personal.lastSent", { date: formatDateValue(digestSubscription.lastSentAt) })}
                                                size="small"
                                                variant="outlined"
                                                sx={{ color: "rgba(255,255,255,0.72)", borderColor: "rgba(255,255,255,0.16)" }}
                                            />
                                        ) : null}
                                    </Stack>
                                    <TextField
                                        select
                                        label={t("personal.frequency")}
                                        value={digestForm.frequency}
                                        onChange={(event) => setDigestForm((current) => ({ ...current, frequency: event.target.value === "weekly" ? "weekly" : "daily" }))}
                                        fullWidth
                                        sx={dashboardFieldSx(dashboardAccents.settings)}
                                    >
                                        <MenuItem value="daily">{t("personal.daily")}</MenuItem>
                                        <MenuItem value="weekly">{t("personal.weekly")}</MenuItem>
                                    </TextField>
                                    {digestForm.frequency === "weekly" ? (
                                        <TextField
                                            select
                                            label={t("personal.weekday")}
                                            value={digestForm.dayOfWeek}
                                            onChange={(event) => setDigestForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                                            fullWidth
                                            sx={dashboardFieldSx(dashboardAccents.settings)}
                                        >
                                            {weekdayOptions.map((option) => (
                                                <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>
                                            ))}
                                        </TextField>
                                    ) : null}
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                        <TextField
                                            label={t("personal.deliveryTime")}
                                            value={digestForm.runAt}
                                            onChange={(event) => setDigestForm((current) => ({ ...current, runAt: event.target.value }))}
                                            placeholder="09:00"
                                            fullWidth
                                            sx={dashboardFieldSx(dashboardAccents.settings)}
                                        />
                                        <TextField
                                            label={t("personal.timezone")}
                                            value={digestForm.timezone}
                                            onChange={(event) => setDigestForm((current) => ({ ...current, timezone: event.target.value }))}
                                            placeholder={settings?.timezone ?? "Europe/Amsterdam"}
                                            fullWidth
                                            sx={dashboardFieldSx(dashboardAccents.settings)}
                                        />
                                    </Stack>
                                    <Stack spacing={1.25}>
                                        <Typography sx={{ color: "grey.300", fontWeight: 800 }}>{t("personal.digestCategories")}</Typography>
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                            <DigestCategoryToggle
                                                label={t("personal.categoryReminders")}
                                                checked={digestForm.includeReminders}
                                                accent={dashboardAccents.birthdays}
                                                onChange={(checked) => setDigestForm((current) => ({ ...current, includeReminders: checked }))}
                                            />
                                            <DigestCategoryToggle
                                                label={t("personal.categoryAnime")}
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
                                            {t("personal.saveDigest")}
                                        </Button>
                                        {digestSubscription ? (
                                            <Button
                                                variant="outlined"
                                                startIcon={digestSubscription.paused ? <PlayArrow /> : <PauseCircle />}
                                                disabled={saving}
                                                onClick={() => void toggleDigestPaused()}
                                                sx={ghostActionButtonSx(dashboardAccents.settings)}
                                            >
                                                {digestSubscription.paused ? t("common.resume") : t("common.pause")}
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
    const { t } = useDashboardI18n();

    return (
        <FeaturePanel accent={dashboardAccents.patchNotes}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            {t("personal.riotTitle")}
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
                        <Tooltip title={t("personal.refreshRiot")}>
                            <IconButton
                                aria-label={t("personal.refreshRiotAria")}
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
                            {t("personal.riotChangesHelp")}
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
    const { t } = useDashboardI18n();

    return (
        <FeaturePanel accent={dashboardAccents.settings}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            {t("personal.subscriptionOverviewTitle")}
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
    const { t, formatNumber } = useDashboardI18n();
    const summary = loading
        ? t("personal.activityLoadingRecent")
        : t("personal.activitySummary", {
            events: t(auditTotal === 1 ? "personal.activityEventOne" : "personal.activityEventMany", { count: formatNumber(auditTotal) }),
            deliveries: t(deliveryTotal === 1 ? "personal.activityDeliveryOne" : "personal.activityDeliveryMany", { count: formatNumber(deliveryTotal) }),
        });

    return (
        <FeaturePanel accent={dashboardAccents.commands}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            {t("personal.activityTitle")}
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
                        {t("common.refresh")}
                    </Button>
                </Stack>

                {items.length === 0 ? (
                    <EmptyPersonalState icon={<AccessTime />} title={loading ? t("personal.activityLoading") : t("personal.activityEmpty")} accent={dashboardAccents.commands} />
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
    const { t, formatDate } = useDashboardI18n();
    const accent = item.type === "delivery"
        ? dashboardAccents.birthdays
        : item.status === "failure" ? dashboardAccents.quotes : dashboardAccents.commands;
    const label = item.type === "delivery"
        ? t("personal.activityDeliveryLabel")
        : item.status === "failure" ? t("personal.activityFailedLabel") : t("personal.activityAuditLabel");

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
                    {formatOptionalDate(item.timestamp, formatDate, t("common.unknown"))}
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

function PersonalAnimeSubscribeForm({ saving, onSubscribe }: {
    saving: boolean;
    onSubscribe: (input: { anilistId?: number; title?: string; reminderMinutes?: number }) => void | Promise<void>;
}) {
    const { locale, t } = useDashboardI18n();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<AnimeSearchResult[]>([]);
    const [selectedAnime, setSelectedAnime] = useState<AnimeSearchResult | null>(null);
    const [reminderMinutes, setReminderMinutes] = useState(30);
    const [searchLoading, setSearchLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2 || (selectedAnime && formatAnimeTitle(selectedAnime) === trimmed)) {
            if (trimmed.length < 2) setResults([]);
            return;
        }

        const handle = window.setTimeout(() => {
            setSearchLoading(true);
            api.searchAnime(trimmed, 1, 8, "anime")
                .then((response) => {
                    setResults(response.results);
                    setLocalError(null);
                })
                .catch((err: unknown) => setLocalError(errorMessage(err, t("anime.searchFailed"))))
                .finally(() => setSearchLoading(false));
        }, 250);

        return () => window.clearTimeout(handle);
    }, [query, selectedAnime, t]);

    const invalidSelectedAnime = Boolean(selectedAnime && !canSubscribe(selectedAnime));
    const submitDisabled = saving || !query.trim() || invalidSelectedAnime;

    const submit = async () => {
        const trimmed = query.trim();
        if (!trimmed) {
            setLocalError(t("anime.pickAnimeOrEnterAniListId"));
            return;
        }
        if (selectedAnime && !canSubscribe(selectedAnime)) {
            setLocalError(t("anime.statusCannotReceiveReminders", { status: formatStatus(selectedAnime.status, locale) }));
            return;
        }

        const numericId = Number(trimmed);
        const input = selectedAnime
            ? { anilistId: selectedAnime.id, reminderMinutes }
            : Number.isInteger(numericId) && numericId > 0
                ? { anilistId: numericId, reminderMinutes }
                : { title: trimmed, reminderMinutes };

        try {
            await onSubscribe(input);
            setQuery("");
            setResults([]);
            setSelectedAnime(null);
            setLocalError(null);
        } catch {
            // Hook exposes the error state.
        }
    };

    return (
        <Box sx={{ ...dashboardCardSx(dashboardAccents.anime), p: 2 }}>
            <Stack spacing={1.5} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ alignItems: { md: "flex-start" } }}>
                    <Autocomplete
                        fullWidth
                        options={results}
                        loading={searchLoading}
                        value={selectedAnime}
                        inputValue={query}
                        onInputChange={(_event, value) => {
                            setQuery(value);
                            setSelectedAnime((current) => current && formatAnimeTitle(current) !== value ? null : current);
                        }}
                        onChange={(_event, value) => {
                            setSelectedAnime(value);
                            if (value) setQuery(formatAnimeTitle(value));
                        }}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        getOptionLabel={(option) => formatAnimeTitle(option)}
                        noOptionsText={query.trim().length < 2 ? t("config.typeAtLeastTwoCharacters") : t("anime.noResults")}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.id} sx={{ bgcolor: "rgba(18,24,34,0.98)", color: "grey.100", py: 1 }}>
                                <AnimeMediaRow anime={option} dense />
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t("anime.anime")}
                                placeholder={t("anime.personalSearchPlaceholder", { example: "Frieren" })}
                                helperText={invalidSelectedAnime ? t("anime.statusCannotReceiveReminders", { status: formatStatus(selectedAnime?.status, locale) }) : " "}
                                sx={dashboardFieldSx(dashboardAccents.anime)}
                                slotProps={{
                                    ...params.slotProps,
                                    input: {
                                        ...params.slotProps.input,
                                        startAdornment: (
                                            <>
                                                <InputAdornment position="start">
                                                    <Search fontSize="small" />
                                                </InputAdornment>
                                                {params.slotProps.input.startAdornment}
                                            </>
                                        ),
                                        endAdornment: (
                                            <>
                                                {searchLoading ? <CircularProgress size={18} /> : null}
                                                {params.slotProps.input.endAdornment}
                                            </>
                                        ),
                                    },
                                    formHelperText: {
                                        sx: { color: invalidSelectedAnime ? "warning.light" : "rgba(255,255,255,0.36)" },
                                    },
                                }}
                            />
                        )}
                    />
                    <TextField
                        select
                        label={t("anime.reminderTiming")}
                        value={reminderMinutes}
                        onChange={(event) => setReminderMinutes(Number(event.target.value))}
                        sx={{ ...dashboardFieldSx(dashboardAccents.anime), minWidth: { md: 180 } }}
                    >
                        {[0, 5, 10, 15, 30, 60, 120, 360].map((minutes) => (
                            <MenuItem key={minutes} value={minutes}>
                                {minutes === 0 ? t("anime.atAirTime") : t("anime.minutesBefore", { minutes })}
                            </MenuItem>
                        ))}
                    </TextField>
                </Stack>

                {selectedAnime ? (
                    <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <AnimeMediaRow anime={selectedAnime} dense />
                    </Box>
                ) : null}

                {localError ? (
                    <Alert severity="warning" sx={{ bgcolor: "rgba(255,200,87,0.12)", color: "grey.50", border: "1px solid rgba(255,200,87,0.30)" }}>
                        {localError}
                    </Alert>
                ) : null}

                <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    disabled={submitDisabled}
                    onClick={() => void submit()}
                    sx={primaryActionButtonSx(dashboardAccents.anime)}
                >
                    {saving ? t("anime.saving") : t("anime.addDmSubscription")}
                </Button>
            </Stack>
        </Box>
    );
}

function AnimeSubscriptionCard({ subscription, saving, onTogglePaused, onDelete }: {
    subscription: AnimeSubscriptionDashboardConfig;
    saving: boolean;
    onTogglePaused: (subscription: AnimeSubscriptionDashboardConfig) => void | Promise<unknown>;
    onDelete: (subscription: AnimeSubscriptionDashboardConfig) => void | Promise<void>;
}) {
    const { locale, t } = useDashboardI18n();
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
                            {subscriptionMeta(subscription, locale)}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                            <Chip
                                label={t("anime.anilistId", { id: subscription.anilistId })}
                                size="small"
                                variant="outlined"
                                sx={{ color: "rgba(255,255,255,0.68)", borderColor: "rgba(255,255,255,0.16)" }}
                            />
                            {paused && (
                                <Chip
                                    label={t("common.paused")}
                                    size="small"
                                    sx={{ bgcolor: "rgba(104,215,255,0.14)", color: "grey.50" }}
                                />
                            )}
                        </Stack>
                    </Box>
                    <Tooltip title={t("common.delete")}>
                        <IconButton aria-label={t("anime.deletePersonalSubscription")} onClick={() => void onDelete(subscription)} disabled={saving} sx={{ color: dashboardAccents.quotes }}>
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
                    {paused ? t("anime.resumeReminders") : t("anime.pauseReminders")}
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
    const { t, formatDate } = useDashboardI18n();

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
                                    label={t("personal.pinned")}
                                    size="small"
                                    sx={{ bgcolor: alpha(dashboardAccents.commands, 0.16), color: "grey.50" }}
                                />
                            )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>
                            {t("personal.noteUpdated", { date: formatOptionalDate(note.updatedAt, formatDate, t("common.unknown")) })}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title={note.pinned ? t("personal.unpin") : t("personal.pin")}>
                            <IconButton
                                aria-label={note.pinned ? t("personal.unpinNoteAria") : t("personal.pinNoteAria")}
                                onClick={() => void onTogglePinned(note)}
                                sx={{ color: note.pinned ? dashboardAccents.commands : "grey.300" }}
                            >
                                <PushPin fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t("common.edit")}>
                            <IconButton aria-label={t("personal.editNoteAria")} onClick={() => onEdit(note)} sx={{ color: "grey.300" }}>
                                <Edit fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t("common.delete")}>
                            <IconButton aria-label={t("personal.deleteNoteAria")} onClick={() => void onDelete(note)} sx={{ color: dashboardAccents.quotes }}>
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
    const { t, formatDate, formatNumber, formatRelativeTime } = useDashboardI18n();
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
                                label={paused ? t("personal.statusPaused") : formatReminderRelative(reminder.timestamp, formatRelativeTime, t)}
                                size="small"
                                sx={{
                                    bgcolor: paused
                                        ? "rgba(104,215,255,0.14)"
                                        : due ? "rgba(255,107,154,0.16)" : alpha(dashboardAccents.birthdays, 0.16),
                                    color: "grey.50",
                                }}
                            />
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                                {formatOptionalDate(reminder.timestamp, formatDate, t("personal.unknownTime"))}
                            </Typography>
                            {reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone ? (
                                <Chip
                                    icon={<Schedule fontSize="small" />}
                                    label={formatReminderRecurrenceLabel(reminder, t, formatNumber)}
                                    size="small"
                                    sx={{
                                        bgcolor: alpha(dashboardAccents.settings, 0.14),
                                        color: "grey.50",
                                    }}
                                />
                            ) : null}
                            {recurring ? (
                                <Chip
                                    label={t(paused ? "personal.reminderNextAfterResume" : "personal.reminderNextRun", {
                                        date: formatOptionalDate(nextPreviewAt, formatDate, t("personal.unknownTime")),
                                    })}
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
                    <Tooltip title={t("common.delete")}>
                        <IconButton aria-label={t("personal.deleteReminderAria")} onClick={() => void onDelete(reminder)} disabled={saving} sx={{ color: dashboardAccents.quotes }}>
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
                            {paused ? t("common.resume") : t("common.pause")}
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
                            {t("personal.snooze", { timespan })}
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

function formatDigestStatus(status: "active" | "paused" | "off", t: DashboardTranslator): string {
    if (status === "active") return t("personal.statusActive");
    if (status === "paused") return t("personal.statusPaused");
    return t("personal.statusNotConfigured");
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

function formatOptionalDate(
    value: string | number | null,
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string,
    fallback: string,
): string {
    if (value === null || value === "") return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return formatDate(date, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatReminderRecurrenceLabel(
    reminder: UserReminder,
    t: DashboardTranslator,
    formatNumber: (value: number) => string,
): string {
    if (!reminder.recurrenceUnit || !reminder.recurrenceInterval || !reminder.recurrenceTimezone) return t("personal.reminderOneOff");
    const unit = formatReminderUnit(reminder.recurrenceUnit, reminder.recurrenceInterval !== 1, t);
    const cadence = reminder.recurrenceInterval === 1
        ? t("personal.reminderEveryOne", { unit })
        : t("personal.reminderEveryMany", { count: formatNumber(reminder.recurrenceInterval), unit });
    return `${cadence} - ${reminder.recurrenceTimezone}`;
}

function formatReminderUnit(unit: NonNullable<UserReminder["recurrenceUnit"]>, plural: boolean, t: DashboardTranslator): string {
    if (unit === "day") return t(plural ? "personal.unitDays" : "personal.unitDay");
    if (unit === "week") return t(plural ? "personal.unitWeeks" : "personal.unitWeek");
    return t(plural ? "personal.unitMonths" : "personal.unitMonth");
}

function formatReminderRelative(
    timestamp: number,
    formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string,
    t: DashboardTranslator,
): string {
    const diffMs = timestamp - Date.now();
    if (diffMs <= 0) return t("personal.reminderDueNow");

    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 1) return t("personal.reminderDueUnderMinute");
    if (minutes < 60) return formatRelativeTime(minutes, "minute", { numeric: "always" });

    const hours = Math.round(minutes / 60);
    if (hours < 48) return formatRelativeTime(hours, "hour", { numeric: "always" });

    const days = Math.round(hours / 24);
    return formatRelativeTime(days, "day", { numeric: "always" });
}
