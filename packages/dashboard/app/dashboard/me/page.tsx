"use client";
import { MorningBriefingPanel } from "@/components/today/MorningBriefingPanel";
import { PollTemplatesPanel } from "@/components/polls/PollTemplatesPanel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Divider, Stack, Typography } from "@mui/material";
import { Add, AlarmAdd, NoteAlt, NotificationsActive, Movie, Schedule } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { subscriptionTitle } from "@/components/anime/animeUtils";
import { useMyRiotLink } from "@/components/hooks/useMyRiotLink";
import { useUserAnimeSubscriptions } from "@/components/hooks/useUserAnimeSubscriptions";
import { useUserActivity } from "@/components/hooks/useUserActivity";
import { useUserDigestSubscription } from "@/components/hooks/useUserDigestSubscription";
import { useUserNotes } from "@/components/hooks/useUserNotes";
import { NoteInboxPanel } from "@/components/notes/NoteInboxPanel";
import { CalendarPanel } from "@/components/calendar/CalendarPanel";
import { TodayPanel } from "@/components/today/TodayPanel";
import { TasksPanel } from "@/components/tasks/TasksPanel";
import { ChecklistTemplatesPanel } from "@/components/tasks/ChecklistTemplatesPanel";
import { useUserReminders } from "@/components/hooks/useUserReminders";
import { useUserSettings } from "@/components/hooks/useUserSettings";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { type AnimeSubscriptionDashboardConfig, type UserDigestCategory, type UserDigestFrequency, type UserNote, type UserReminder, type UserSettingsUpdateInput } from "@/lib/api-client";
import { buildPersonalRiotSummary } from "@/lib/personalRiotSummary";
import { buildPersonalSubscriptionOverview } from "@/lib/personalSubscriptionOverview";
import { buildUserActivityFeed } from "@/lib/userActivityFeed";

import { NotificationPausePanel } from "@/components/dashboard/NotificationPausePanel";
import { NotificationHistoryPanel } from "@/components/dashboard/NotificationHistoryPanel";
import { PersonalDashboardSections } from "@/components/dashboard/PersonalDashboardSections";
import type { PersonalEditorId } from "@/components/dashboard/personalDashboardViews";
import { RiotLinkPanel, UserActivityPanel, PersonalAnimeSubscribeForm, AnimeSubscriptionCard, ReminderCard, isPausedRecurringReminder, EmptyPersonalState } from "@/components/personal/PersonalDashboardPanels";
import { PersonalOverviewSubscriptions } from "@/components/personal/PersonalOverviewSubscriptions";

import { PersonalNoteEditor, PersonalReminderEditor, PersonalSettingsEditor, PersonalDigestEditor } from "@/components/personal/PersonalDashboardForms";

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
        refresh: refreshReminders,
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
    const [editorRequest, setEditorRequest] = useState<{ id: PersonalEditorId } | null>(null);
    const [noteForm, setNoteForm] = useState<NoteFormState>(emptyNoteForm);
    const [reminderForm, setReminderForm] = useState<ReminderFormState>(emptyReminderForm);
    const [settingsForm, setSettingsForm] = useState<SettingsFormState>(emptySettingsForm);
    const [digestForm, setDigestForm] = useState<DigestFormState>(emptyDigestForm);
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


    const pageError = (editorRequest?.id === 'noteEditor' ? null : noteLocalError ?? notesError)
        ?? (editorRequest?.id === 'reminderEditor' ? null : reminderLocalError ?? remindersError)
        ?? settingsLocalError ?? digestLocalError ?? animeError ?? settingsError ?? digestError ?? activityError ?? riotError;
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
        setEditorRequest(null);
    };

    const startEdit = (note: UserNote) => {
        setEditingId(note.id);
        setNoteForm({
            title: note.title,
            body: note.body,
            pinned: note.pinned,
        });
        setNoteLocalError(null);
        setEditorRequest({ id: 'noteEditor' });
    };
    const openEditor = (id: PersonalEditorId) => {
        if (id === 'noteEditor') resetNoteForm();
        setEditorRequest({ id });
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
            setEditorRequest(null);
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
                    compact
                    icon={<NoteAlt />}
                    eyebrow={t("personal.eyebrow")}
                    title={t("personal.title")}
                    description={t("personal.description")}
                    accent={dashboardAccents.commands}
                    secondaryAccent={dashboardAccents.birthdays}
                    stats={[
                        { label: t("personal.statNotes"), value: formatNumber(notes.length) },
                        { label: t("personal.statReminders"), value: formatNumber(activeReminderCount) },
                        { label: t("anime.personalSubscriptionStat"), value: formatNumber(animeSubscriptions.length) },
                    ]}
                    actions={(
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => openEditor('noteEditor')}
                            sx={primaryActionButtonSx(dashboardAccents.commands)}
                        >
                            {t("personal.newNote")}
                        </Button>
                        <Button size="small" variant="contained" startIcon={<AlarmAdd />} onClick={() => openEditor('reminderEditor')}
                            sx={primaryActionButtonSx(dashboardAccents.birthdays)}>{t('personal.createReminder')}</Button>
                        </Stack>
                    )}
                />

                <Stack spacing={3}>
                    {pageError && (
                        <Alert severity="error" sx={{ bgcolor: "rgba(127,29,29,0.52)", color: "error.light" }}>
                            {pageError}
                        </Alert>
                    )}
                    <NotificationPausePanel compact revision={settings?.timezone ?? "UTC"} />
                    <PersonalDashboardSections editorRequest={editorRequest} editorBusy={notesSaving || remindersSaving}
                        onCreateEditor={openEditor} onCloseEditor={() => setEditorRequest(null)}
                        editorErrors={{ noteEditor: noteLocalError ?? notesError, reminderEditor: reminderLocalError ?? remindersError }} panels={{
                        today: (
                            <TodayPanel revision={`${settings?.timezone ?? 'UTC'}:${reminders.map(item => `${item.id}:${item.timestamp}:${item.completed}`).join('|')}`} onRemindersChanged={() => void refreshReminders()} />
                        ),
                        calendar: (
                            <CalendarPanel />
                        ),
                        tasks: (
                            <TasksPanel />
                        ),
                        briefing: (
                            <MorningBriefingPanel revision={settings?.timezone ?? 'UTC'} />
                        ),
                        notificationHistory: (
                            <NotificationHistoryPanel timezone={settings?.timezone ?? 'UTC'} />
                        ),
                        pollTemplates: (
                            <PollTemplatesPanel />
                        ),
                        checklistTemplates: (
                            <ChecklistTemplatesPanel />
                        ),
                        noteEditor: <PersonalNoteEditor editingNote={editingNote} noteForm={noteForm} setNoteForm={setNoteForm} saving={saving} submitNoteForm={submitNoteForm} resetNoteForm={resetNoteForm} />,
                        notes: (
                            <NoteInboxPanel notes={notes} saving={notesSaving} onTogglePinned={togglePinned} onEdit={startEdit} onDelete={removeNote} onUpdate={updateNote} />
                        ),
                        reminders: (
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
                        ),
                        anime: (
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
                        ),
                        reminderEditor: <PersonalReminderEditor reminderForm={reminderForm} setReminderForm={setReminderForm} settings={settings} saving={saving} submitReminderForm={submitReminderForm} />,
                        subscriptions: (
                            <PersonalOverviewSubscriptions overview={subscriptionOverview} />
                        ),
                        settings: <PersonalSettingsEditor settingsForm={settingsForm} setSettingsForm={setSettingsForm} settings={settings} saving={saving} submitSettingsForm={submitSettingsForm} />,
                        digest: <PersonalDigestEditor digestForm={digestForm} setDigestForm={setDigestForm} digestSubscription={digestSubscription} digestStatus={digestStatus} settings={settings} saving={saving} formatDateValue={formatDateValue} submitDigestForm={submitDigestForm} toggleDigestPaused={toggleDigestPaused} />,
                        riot: (
                            <RiotLinkPanel summary={riotSummary} loading={riotLoading} onRefresh={refreshRiotLink} />
                        ),
                        activity: (
                            <UserActivityPanel
                                items={activityFeed}
                                auditTotal={activity?.summary.auditTotal ?? 0}
                                deliveryTotal={activity?.summary.deliveryTotal ?? 0}
                                loading={activityLoading}
                                onRefresh={refreshActivity}
                            />
                        ),
                    }} />
                </Stack>
            </FeatureShell>
        </DashboardLayout>
    );
}
