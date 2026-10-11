"use client";
import type { Dispatch, SetStateAction } from 'react';
import { Alert, AlertTitle, Box, Button, Chip, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { AlarmAdd, ManageAccounts, NotificationsActive, PauseCircle, PlayArrow, Save, WarningAmber } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx, primaryActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import type { UserNote, UserDigestFrequency } from '@/lib/api-client';
import type { UserSettings } from '@/lib/api/userSettings';
import type { UserDigestSubscription } from '@/lib/api/userDigestSubscription';
import type { DashboardMessageKey } from '@/lib/i18n/messages';
import { DigestCategoryToggle, formatDigestStatus } from './PersonalDashboardPanels';
type Setter<T> = Dispatch<SetStateAction<T>>;
interface NoteForm { title: string; body: string; pinned: boolean }
interface ReminderForm { message: string; timespan: string; recurrence: string; recurrenceTimezone: string }
interface SettingsForm { timezone: string; defaultReminderTimeSpan: string }
interface DigestForm { frequency: UserDigestFrequency; timezone: string; runAt: string; dayOfWeek: string; includeReminders: boolean; includeAnime: boolean }
const weekdayOptions = [
    { value: "0", labelKey: "personal.weekdaySunday" },
    { value: "1", labelKey: "personal.weekdayMonday" },
    { value: "2", labelKey: "personal.weekdayTuesday" },
    { value: "3", labelKey: "personal.weekdayWednesday" },
    { value: "4", labelKey: "personal.weekdayThursday" },
    { value: "5", labelKey: "personal.weekdayFriday" },
    { value: "6", labelKey: "personal.weekdaySaturday" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: DashboardMessageKey }>;

export function PersonalNoteEditor({ editingNote, noteForm, setNoteForm, saving, submitNoteForm, resetNoteForm }: {
    editingNote: UserNote | null;
    noteForm: NoteForm;
    setNoteForm: Setter<NoteForm>;
    saving: boolean;
    submitNoteForm: () => Promise<void>;
    resetNoteForm: () => void;
}) {
    const { t } = useDashboardI18n();
    return (
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
                            slotProps={{ input: { 'aria-label': t('personal.pinned') } }}
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
                    autoFocus
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
    );
}

export function PersonalReminderEditor({ reminderForm, setReminderForm, settings, saving, submitReminderForm }: {
    reminderForm: ReminderForm;
    setReminderForm: Setter<ReminderForm>;
    settings: UserSettings | null;
    saving: boolean;
    submitReminderForm: () => Promise<void>;
}) {
    const { t } = useDashboardI18n();
    return (
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
                    autoFocus
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
    );
}

export function PersonalSettingsEditor({ settingsForm, setSettingsForm, settings, saving, submitSettingsForm }: {
    settingsForm: SettingsForm;
    setSettingsForm: Setter<SettingsForm>;
    settings: UserSettings | null;
    saving: boolean;
    submitSettingsForm: () => Promise<void>;
}) {
    const { t } = useDashboardI18n();
    return (
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
    );
}

export function PersonalDigestEditor({ digestForm, setDigestForm, digestSubscription, digestStatus, settings, saving, formatDateValue, submitDigestForm, toggleDigestPaused }: {
    digestForm: DigestForm;
    setDigestForm: Setter<DigestForm>;
    digestSubscription: UserDigestSubscription | null;
    digestStatus: "active" | "paused" | "off";
    settings: UserSettings | null;
    saving: boolean;
    formatDateValue: (value: string | number | null) => string;
    submitDigestForm: () => Promise<void>;
    toggleDigestPaused: () => Promise<void>;
}) {
    const { t } = useDashboardI18n();
    return (
        <FeaturePanel accent={dashboardAccents.settings}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>
                            {t("personal.digestTitle")}
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
                <Box component="details">
                    <Typography component="summary" sx={{ color: 'grey.100', fontWeight: 700, cursor: 'pointer' }}>{t('dashboardLayout.configure')}</Typography>
                    <Stack spacing={2.25} sx={{ mt: 2 }}>
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
                </Box>
            </Stack>
        </FeaturePanel>
    );
}
