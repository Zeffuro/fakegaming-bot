"use client";
import React, { useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { AccessTime, Add, Delete, ManageAccounts, NotificationsActive, Movie, PauseCircle, PlayArrow, Refresh, Schedule, Search, SportsEsports } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { AnimeMediaRow } from "@/components/anime/AnimeMediaRow";
import { canSubscribe, errorMessage, formatAnimeTitle, formatStatus, subscriptionMeta, subscriptionTitle } from "@/components/anime/animeUtils";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { api, type AnimeSearchResult, type AnimeSubscriptionDashboardConfig, type UserReminder } from "@/lib/api-client";
import type { DashboardTranslator } from "@/lib/i18n/messages";
import { type PersonalRiotSummary, type PersonalRiotSummaryTone } from "@/lib/personalRiotSummary";
import { type PersonalSubscriptionOverview, type PersonalSubscriptionOverviewItem } from "@/lib/personalSubscriptionOverview";
import { type UserActivityFeedItem } from "@/lib/userActivityFeed";

export function RiotLinkPanel({ summary, loading, onRefresh }: {
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

export function PersonalSubscriptionOverviewPanel({ overview }: { overview: PersonalSubscriptionOverview }) {
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

export function UserActivityPanel({
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

export function PersonalAnimeSubscribeForm({ saving, onSubscribe }: {
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

export function AnimeSubscriptionCard({ subscription, saving, onTogglePaused, onDelete }: {
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

export function ReminderCard({ reminder, saving, onSnooze, onTogglePaused, onDelete }: {
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

export function isRecurringReminder(reminder: UserReminder): boolean {
    return Boolean(reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone);
}

export function isPausedRecurringReminder(reminder: UserReminder): boolean {
    return reminder.completed && isRecurringReminder(reminder);
}

export function formatDigestStatus(status: "active" | "paused" | "off", t: DashboardTranslator): string {
    if (status === "active") return t("personal.statusActive");
    if (status === "paused") return t("personal.statusPaused");
    return t("personal.statusNotConfigured");
}

export function DigestCategoryToggle({ label, checked, accent, onChange }: {
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

export function EmptyPersonalState({ icon, title, accent }: { icon: React.ReactNode; title: string; accent: string }) {
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
