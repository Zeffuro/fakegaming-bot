"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPage } from "@/components/AdminPage";
import { AdminSavedViews, type AdminSavedViewPreset } from "@/components/admin/AdminSavedViews";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import {
    dashboardAccents,
    dashboardFieldSx,
    ghostActionButtonSx,
    primaryActionButtonSx,
} from "@/components/dashboard/dashboardTheme";
import { api, type JobRunEntry, type PatchNotesStorageSummary } from "@/lib/api-client";
import { adminJobRunsCsvHeaders, buildAdminJobRunCsvRows } from "@/lib/adminAnalyticsExports";
import { getAdminJobRunDetails } from "@/lib/adminJobRunDetails";
import { buildAdminJobRetryPayload, canRetryAdminJobRun } from "@/lib/adminJobRetry";
import { createCsvFilename, downloadCsv } from "@/lib/csvExport";
import { getDashboardIntlLocale, type DashboardLocale } from "@/lib/i18n/localeStore";
import { formatDashboardMessage } from "@/lib/i18n/messages";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    CheckCircle,
    Download,
    ErrorOutlined,
    Favorite,
    MonitorHeart,
    PlayArrow,
    Refresh,
    RestartAlt,
    Schedule,
    Storage,
    WarningAmber,
    WorkHistory,
} from "@mui/icons-material";

interface TriggerResult {
    ok: boolean;
    jobId?: string | number;
    error?: string;
}

interface JobInfo {
    name: string;
    supportsDate: boolean;
    supportsForce: boolean;
}

type RunFilter = "all" | "failed";

function formatDateTime(value: string | null | undefined, locale: DashboardLocale): string {
    if (!value) return formatDashboardMessage(locale, "admin.jobsUnknown");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(getDashboardIntlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatTimestampMs(value: number | null | undefined, locale: DashboardLocale): string {
    if (typeof value !== "number") return formatDashboardMessage(locale, "admin.jobsUnknown");
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? formatDashboardMessage(locale, "admin.jobsUnknown")
        : new Intl.DateTimeFormat(getDashboardIntlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatBytes(value: number, locale: DashboardLocale): string {
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let amount = value;
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
        amount /= 1024;
        unitIndex += 1;
    }
    const fractionDigits = amount >= 10 || unitIndex === 0 ? 0 : 1;
    return `${new Intl.NumberFormat(getDashboardIntlLocale(locale), { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits }).format(amount)} ${units[unitIndex]}`;
}

function getRunKey(run: JobRunEntry, index: number): string {
    return `${run.startedAt}:${run.finishedAt}:${index}`;
}

function parseRunFilter(value: string | null): RunFilter {
    return value === "failed" ? "failed" : "all";
}

function serializeJobFilters(input: { job: string; result: RunFilter }): string {
    const params = new URLSearchParams();
    const job = input.job.trim();
    if (job && job !== "birthdays") params.set("job", job);
    if (input.result === "failed") params.set("result", input.result);
    return params.toString();
}

function StatPanel({
    title,
    icon,
    accent,
    loading,
    onRefresh,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    accent: string;
    loading: boolean;
    onRefresh: () => void;
    children: React.ReactNode;
}) {
    const { t } = useDashboardI18n();
    return (
        <FeaturePanel accent={accent} sx={{ p: 2.5, minHeight: 210, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1.5, position: "relative", mb: 2 }}>
                <Stack direction="row" spacing={1.1} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>{icon}</Box>
                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                        {title}
                    </Typography>
                </Stack>
                <Button size="small" variant="outlined" onClick={onRefresh} disabled={loading} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                    {t("admin.jobsRefresh")}
                </Button>
            </Stack>
            <Box sx={{ position: "relative", flex: 1 }}>{children}</Box>
        </FeaturePanel>
    );
}

function AdminJobsContent() {
    const { locale, t, formatNumber } = useDashboardI18n();
    const accent = dashboardAccents.admin;
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchParamString = searchParams?.toString() ?? "";
    const fallbackJobs: JobInfo[] = useMemo(() => ([
        { name: "birthdays", supportsDate: true, supportsForce: true },
        { name: "heartbeat", supportsDate: false, supportsForce: false },
    ]), []);
    const savedViewPresets = useMemo<AdminSavedViewPreset[]>(() => [
        { id: "jobs:failed", label: t("admin.jobsPresetFailed"), query: "result=failed" },
        { id: "jobs:birthdays", label: t("admin.jobsPresetBirthdays"), query: "job=birthdays&result=failed" },
        { id: "jobs:heartbeat", label: t("admin.jobsPresetHeartbeat"), query: "job=heartbeat&result=failed" },
    ], [t]);

    const [jobs, setJobs] = useState<JobInfo[]>(fallbackJobs);
    const [selectedJob, setSelectedJob] = useState<string>(() => searchParams?.get("job")?.trim() || "birthdays");
    const [resultFilter, setResultFilter] = useState<RunFilter>(() => parseRunFilter(searchParams?.get("result") ?? null));
    const [date, setDate] = useState<string>("");
    const [force, setForce] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState(false);
    const [retryingRunKey, setRetryingRunKey] = useState<string | null>(null);
    const [result, setResult] = useState<TriggerResult | null>(null);

    const [lastHeartbeat, setLastHeartbeat] = useState<{ startedAt: string; backend: string; receivedAt: string } | null>(null);
    const [loadingHeartbeat, setLoadingHeartbeat] = useState<boolean>(false);

    const [runs, setRuns] = useState<JobRunEntry[]>([]);
    const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

    const [birthdaysToday, setBirthdaysToday] = useState<number | null>(null);
    const [loadingBirthdaysToday, setLoadingBirthdaysToday] = useState<boolean>(false);

    const [patchNotesStorage, setPatchNotesStorage] = useState<PatchNotesStorageSummary | null>(null);
    const [loadingPatchNotesStorage, setLoadingPatchNotesStorage] = useState<boolean>(false);

    const selectedMeta = useMemo(() => jobs.find((j) => j.name === selectedJob), [jobs, selectedJob]);
    const savedViewQuery = useMemo(() => serializeJobFilters({ job: selectedJob, result: resultFilter }), [resultFilter, selectedJob]);
    const visibleRuns = useMemo(() => resultFilter === "failed" ? runs.filter(run => run.ok === false) : runs, [resultFilter, runs]);
    const exportVisibleRuns = useCallback(() => {
        downloadCsv(
            createCsvFilename(`admin-${selectedJob}-job-runs`),
            adminJobRunsCsvHeaders,
            buildAdminJobRunCsvRows(selectedJob, visibleRuns),
        );
    }, [selectedJob, visibleRuns]);

    const loadJobs = async () => {
        try {
            const res = await api.getJobs();
            if (Array.isArray(res.jobs) && res.jobs.length > 0) {
                setJobs(res.jobs);
                if (!res.jobs.some((j) => j.name === selectedJob)) {
                    setSelectedJob(res.jobs[0]?.name ?? "birthdays");
                }
            }
        } catch {
            // Keep the local fallback list when the worker job registry is unavailable.
        }
    };

    const loadLastHeartbeat = async () => {
        try {
            setLoadingHeartbeat(true);
            const res = await api.getLastHeartbeat();
            setLastHeartbeat(res.last ?? null);
        } catch {
            // Ignore status-card refresh failures.
        } finally {
            setLoadingHeartbeat(false);
        }
    };

    const loadStatus = async (name: string) => {
        try {
            setLoadingStatus(true);
            const res = await api.getJobStatus(name);
            setRuns(res.runs?.slice(0, 5) ?? []);
        } catch {
            setRuns([]);
        } finally {
            setLoadingStatus(false);
        }
    };

    const loadBirthdaysToday = async () => {
        try {
            setLoadingBirthdaysToday(true);
            const res = await api.getBirthdaysProcessedToday();
            setBirthdaysToday(res.processed);
        } catch {
            setBirthdaysToday(null);
        } finally {
            setLoadingBirthdaysToday(false);
        }
    };

    const loadPatchNotesStorage = async () => {
        try {
            setLoadingPatchNotesStorage(true);
            const res = await api.getPatchNotesStorage();
            setPatchNotesStorage(res);
        } catch {
            setPatchNotesStorage(null);
        } finally {
            setLoadingPatchNotesStorage(false);
        }
    };

    useEffect(() => {
        void loadJobs();
        void loadLastHeartbeat();
        void loadBirthdaysToday();
        void loadPatchNotesStorage();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(searchParamString);
        const nextJob = params.get("job")?.trim();
        const nextSelectedJob = nextJob && jobs.some(job => job.name === nextJob) ? nextJob : "birthdays";
        setSelectedJob(nextSelectedJob);
        setResultFilter(parseRunFilter(params.get("result")));
        setResult(null);
        setForce(false);
        setDate("");
    }, [jobs, searchParamString]);

    useEffect(() => {
        void loadStatus(selectedJob);
    }, [selectedJob]);

    const commitJobFilters = useCallback((nextFilters: { job: string; result: RunFilter }) => {
        setSelectedJob(nextFilters.job);
        setResultFilter(nextFilters.result);
        setResult(null);
        setForce(false);
        setDate("");
        const queryString = serializeJobFilters(nextFilters);
        router.replace(queryString ? `/dashboard/admin/jobs?${queryString}` : "/dashboard/admin/jobs", { scroll: false });
    }, [router]);

    const handleJobChange = (e: SelectChangeEvent<string>) => {
        commitJobFilters({ job: e.target.value, result: resultFilter });
    };

    const handleTrigger = async () => {
        setSubmitting(true);
        setResult(null);
        try {
            const iso = date ? new Date(date).toISOString() : undefined;
            const res = await api.triggerJob(selectedJob, iso, selectedMeta?.supportsForce ? force : undefined);
            setResult({ ok: true, jobId: res.jobId });
            setTimeout(() => { void loadStatus(selectedJob); }, 500);
            if (selectedJob === "heartbeat") {
                setTimeout(() => { void loadLastHeartbeat(); }, 300);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("admin.jobsUnknown");
            setResult({ ok: false, error: message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetryRun = async (run: JobRunEntry, runKey: string) => {
        if (!selectedMeta || !canRetryAdminJobRun(run)) return;
        setRetryingRunKey(runKey);
        setResult(null);
        try {
            const payload = buildAdminJobRetryPayload(selectedMeta, run);
            const res = await api.triggerJob(selectedJob, payload.date, payload.force);
            setResult({ ok: true, jobId: res.jobId });
            setTimeout(() => { void loadStatus(selectedJob); }, 500);
            if (selectedJob === "heartbeat") {
                setTimeout(() => { void loadLastHeartbeat(); }, 300);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("admin.jobsUnknown");
            setResult({ ok: false, error: message });
        } finally {
            setRetryingRunKey(null);
        }
    };

    const renderRunSummary = (r: JobRunEntry, idx: number) => {
        const details = getAdminJobRunDetails(r, selectedJob, locale);
        const runKey = getRunKey(r, idx);
        const retrying = retryingRunKey === runKey;

        return (
            <Box key={runKey} sx={{ position: "relative" }}>
                {idx > 0 && <Divider sx={{ my: 1.2, borderColor: "rgba(255,255,255,0.08)" }} />}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                        {r.ok ? <CheckCircle sx={{ color: dashboardAccents.settings, fontSize: 19 }} /> : <ErrorOutlined sx={{ color: dashboardAccents.quotes, fontSize: 19 }} />}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 760 }}>
                                {r.ok ? t("admin.jobsSuccess") : t("admin.jobsFailed")}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
                                {formatDateTime(r.finishedAt, locale)}
                            </Typography>
                        </Box>
                    </Stack>
                    {details && (
                        <Chip
                            size="small"
                            label={details}
                            sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.74)", border: "1px solid rgba(255,255,255,0.08)" }}
                        />
                    )}
                    {selectedMeta && canRetryAdminJobRun(r) ? (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void handleRetryRun(r, runKey)}
                            disabled={submitting || retryingRunKey !== null}
                            startIcon={<RestartAlt />}
                            sx={ghostActionButtonSx(dashboardAccents.quotes)}
                        >
                            {retrying ? t("admin.jobsRetrying") : t("admin.jobsRetry")}
                        </Button>
                    ) : null}
                </Stack>
            </Box>
        );
    };

    return (
        <AdminPage title={t("admin.jobsPageTitle")} trail={[{ label: t("admin.jobsPageTitle"), href: "/dashboard/admin/jobs" }]}>
            <Stack spacing={2.5}>
                <AdminSavedViews
                    scope="jobs"
                    basePath="/dashboard/admin/jobs"
                    currentQuery={savedViewQuery}
                    defaultLabel={resultFilter === "failed"
                        ? t("admin.jobsFailureView", { job: selectedJob })
                        : t("admin.jobsRunsView", { job: selectedJob })}
                    presets={savedViewPresets}
                />

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(340px, 0.95fr) minmax(0, 1.55fr)" }, gap: 2.5 }}>
                <FeaturePanel accent={accent} sx={{ p: 3, alignSelf: "start" }}>
                    <Stack spacing={2.4} sx={{ position: "relative" }}>
                        <Stack spacing={0.6}>
                            <Chip
                                icon={<PlayArrow />}
                                label={t("admin.jobsManualRun")}
                                sx={{ alignSelf: "flex-start", bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.42)}` }}
                            />
                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900, letterSpacing: 0 }}>
                                {t("admin.jobsTriggerTitle")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                                {t("admin.jobsTriggerDescription")}
                            </Typography>
                        </Stack>

                        <FormControl fullWidth sx={dashboardFieldSx(accent)}>
                            <InputLabel id="job-select-label">{t("admin.jobsJob")}</InputLabel>
                            <Select
                                labelId="job-select-label"
                                id="job-select"
                                value={selectedJob}
                                label={t("admin.jobsJob")}
                                onChange={handleJobChange}
                            >
                                {jobs.map((job) => (
                                    <MenuItem key={job.name} value={job.name}>{job.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedMeta?.supportsDate && (
                            <TextField
                                label={t("admin.jobsDateOptional")}
                                type="datetime-local"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                helperText={t("admin.jobsDateHelp")}
                                slotProps={{ inputLabel: { shrink: true } }}
                                fullWidth
                                sx={dashboardFieldSx(accent)}
                            />
                        )}

                        {selectedMeta?.supportsForce && (
                            <FormControlLabel
                                control={(
                                    <Checkbox
                                        checked={force}
                                        onChange={(_e, checked) => setForce(checked)}
                                        sx={{ color: alpha(accent, 0.55), "&.Mui-checked": { color: accent } }}
                                    />
                                )}
                                label={t("admin.jobsForce")}
                                sx={{ color: "rgba(255,255,255,0.70)" }}
                            />
                        )}

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button variant="contained" onClick={handleTrigger} disabled={submitting} startIcon={<PlayArrow />} sx={primaryActionButtonSx(accent)}>
                                {submitting ? t("admin.jobsTriggering") : t("admin.jobsTrigger")}
                            </Button>
                            <Button variant="outlined" onClick={() => { setDate(""); setForce(false); setResult(null); }} disabled={submitting} startIcon={<RestartAlt />} sx={ghostActionButtonSx(accent)}>
                                {t("admin.jobsReset")}
                            </Button>
                        </Stack>

                        {result && result.ok && (
                            <Alert severity="success" sx={{ bgcolor: alpha(dashboardAccents.settings, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.settings, 0.22)}` }}>
                                {t("admin.jobsScheduled", { id: String(result.jobId) })}
                            </Alert>
                        )}
                        {result && !result.ok && (
                            <Alert severity="error" sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}` }}>
                                {t("admin.jobsFailure", { error: result.error ?? t("admin.jobsUnknown") })}
                            </Alert>
                        )}
                    </Stack>
                </FeaturePanel>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                    <StatPanel title={t("admin.jobsHeartbeat")} icon={<MonitorHeart />} accent={dashboardAccents.commands} loading={loadingHeartbeat} onRefresh={() => void loadLastHeartbeat()}>
                        {lastHeartbeat ? (
                            <Stack spacing={1.15}>
                                <StatusLine label={t("admin.jobsReceived")} value={formatDateTime(lastHeartbeat.receivedAt, locale)} />
                                <StatusLine label={t("admin.jobsWorkerStarted")} value={formatDateTime(lastHeartbeat.startedAt, locale)} />
                                <StatusLine label={t("admin.jobsBackend")} value={lastHeartbeat.backend} />
                            </Stack>
                        ) : (
                            <EmptyStatus icon={<MonitorHeart />} text={t("admin.jobsNoHeartbeat")} />
                        )}
                    </StatPanel>

                    <StatPanel title={t("admin.jobsBirthdaysToday")} icon={<Favorite />} accent={dashboardAccents.birthdays} loading={loadingBirthdaysToday} onRefresh={() => void loadBirthdaysToday()}>
                        {birthdaysToday !== null ? (
                            <Stack spacing={0.8}>
                                <Typography variant="h3" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: 0 }}>
                                    {formatNumber(birthdaysToday)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                                    {t("admin.jobsBirthdaysProcessed", { count: formatNumber(birthdaysToday) })}
                                </Typography>
                            </Stack>
                        ) : (
                            <EmptyStatus icon={<Favorite />} text={t("admin.jobsNoBirthdayData")} />
                        )}
                    </StatPanel>

                    <FeaturePanel accent={dashboardAccents.patchNotes} sx={{ p: 2.5, gridColumn: { xs: "auto", md: "1 / -1" } }}>
                        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1.5, position: "relative", mb: 2 }}>
                            <Stack direction="row" spacing={1.1} sx={{ alignItems: "center", minWidth: 0 }}>
                                <Storage sx={{ color: dashboardAccents.patchNotes }} />
                                <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                                    {t("admin.jobsPatchStorage")}
                                </Typography>
                            </Stack>
                            <Button size="small" variant="outlined" onClick={() => void loadPatchNotesStorage()} disabled={loadingPatchNotesStorage} startIcon={<Refresh />} sx={ghostActionButtonSx(dashboardAccents.patchNotes)}>
                                {t("admin.jobsRefresh")}
                            </Button>
                        </Stack>

                        {patchNotesStorage ? (
                            <Stack spacing={1.4} sx={{ position: "relative" }}>
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
                                    <StatusLine label={t("admin.jobsRows")} value={t("admin.jobsRowsPerGame", {
                                        rows: formatNumber(patchNotesStorage.totalRows),
                                        max: formatNumber(patchNotesStorage.retention.maxRowsPerGame),
                                    })} />
                                    <StatusLine label={t("admin.jobsBodyBytes")} value={formatBytes(patchNotesStorage.totalContentBytes, locale)} />
                                    <StatusLine label={t("admin.jobsOldestKept")} value={formatTimestampMs(getOldestPatchNoteTimestamp(patchNotesStorage), locale)} />
                                    <StatusLine
                                        label={t("admin.jobsLastPrune")}
                                        value={patchNotesStorage.lastScan
                                            ? t("admin.jobsPruneSummary", {
                                                pruned: formatNumber(patchNotesStorage.lastScan.historyPrunedRows),
                                                truncated: formatNumber(patchNotesStorage.lastScan.historyTruncated),
                                            })
                                            : t("admin.jobsNoScan")}
                                    />
                                </Box>

                                {patchNotesStorage.games.length > 0 ? (
                                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                        {patchNotesStorage.games.slice(0, 4).map(game => (
                                            <Chip
                                                key={game.game}
                                                size="small"
                                                label={t("admin.jobsGameStorage", {
                                                    game: game.game,
                                                    rows: formatNumber(game.rows),
                                                    bytes: formatBytes(game.contentBytes, locale),
                                                })}
                                                sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.76)", border: "1px solid rgba(255,255,255,0.08)" }}
                                            />
                                        ))}
                                    </Stack>
                                ) : null}

                                {patchNotesStorage.warnings.length > 0 ? (
                                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                        {patchNotesStorage.warnings.map(warning => (
                                            <Chip
                                                key={warning}
                                                size="small"
                                                icon={<WarningAmber />}
                                                label={formatStorageWarning(warning, locale)}
                                                sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.28)}` }}
                                            />
                                        ))}
                                    </Stack>
                                ) : (
                                    <Chip
                                        size="small"
                                        icon={<CheckCircle />}
                                        label={t("admin.jobsWithinBounds")}
                                        sx={{ alignSelf: "flex-start", bgcolor: alpha(dashboardAccents.settings, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.settings, 0.26)}` }}
                                    />
                                )}
                            </Stack>
                        ) : (
                            <EmptyStatus icon={<Storage />} text={t("admin.jobsNoStorage")} />
                        )}
                    </FeaturePanel>

                    <FeaturePanel accent={accent} sx={{ p: 2.5, gridColumn: { xs: "auto", md: "1 / -1" } }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, position: "relative", mb: 2 }}>
                            <Stack direction="row" spacing={1.1} sx={{ alignItems: "center" }}>
                                <WorkHistory sx={{ color: accent }} />
                                <Box>
                                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                                        {t("admin.jobsRecentRuns")}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.75 }}>
                                        <Chip size="small" label={selectedJob} sx={{ bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.34)}` }} />
                                        {selectedMeta?.supportsDate && <Chip size="small" icon={<Schedule />} label={t("admin.jobsDateCapability")} sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }} />}
                                        {selectedMeta?.supportsForce && <Chip size="small" label={t("admin.jobsForceCapability")} sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }} />}
                                    </Stack>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                <Button size="small" variant="outlined" onClick={exportVisibleRuns} disabled={loadingStatus || visibleRuns.length === 0} startIcon={<Download />} sx={ghostActionButtonSx(accent)}>
                                    {t("admin.jobsExportCsv")}
                                </Button>
                                <Button size="small" variant="outlined" onClick={() => void loadStatus(selectedJob)} disabled={loadingStatus} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                                    {t("admin.jobsRefresh")}
                                </Button>
                            </Stack>
                        </Stack>

                        <FormControl size="small" sx={{ ...dashboardFieldSx(accent), minWidth: 170, mb: 2 }}>
                            <InputLabel id="job-result-filter-label">{t("admin.jobsRuns")}</InputLabel>
                            <Select
                                labelId="job-result-filter-label"
                                label={t("admin.jobsRuns")}
                                value={resultFilter}
                                onChange={(event) => commitJobFilters({ job: selectedJob, result: event.target.value as RunFilter })}
                            >
                                <MenuItem value="all">{t("admin.jobsAllRuns")}</MenuItem>
                                <MenuItem value="failed">{t("admin.jobsFailedOnly")}</MenuItem>
                            </Select>
                        </FormControl>

                        {visibleRuns.length === 0 ? (
                            <EmptyStatus icon={<WorkHistory />} text={resultFilter === "failed" ? t("admin.jobsNoFailedRuns") : t("admin.jobsNoRecentRuns")} />
                        ) : (
                            <Stack sx={{ position: "relative" }}>
                                {visibleRuns.map((run, idx) => renderRunSummary(run, idx))}
                            </Stack>
                        )}
                    </FeaturePanel>
                </Box>
                </Box>
            </Stack>
        </AdminPage>
    );
}

export default function AdminJobsPage() {
    return (
        <Suspense fallback={null}>
            <AdminJobsContent />
        </Suspense>
    );
}

function StatusLine({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)", p: 1.25 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750 }}>
                {value}
            </Typography>
        </Box>
    );
}

function EmptyStatus({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <Stack spacing={1} sx={{ minHeight: 92, alignItems: "center", justifyContent: "center", textAlign: "center", color: "rgba(255,255,255,0.52)" }}>
            <Box sx={{ opacity: 0.6, display: "grid", placeItems: "center" }}>{icon}</Box>
            <Typography variant="body2">{text}</Typography>
        </Stack>
    );
}

function getOldestPatchNoteTimestamp(summary: PatchNotesStorageSummary): number | null {
    const timestamps = summary.games
        .map(game => game.oldestPublishedAt)
        .filter((value): value is number => typeof value === "number");
    return timestamps.length > 0 ? Math.min(...timestamps) : null;
}

function formatStorageWarning(warning: string, locale: DashboardLocale): string {
    if (warning === "records_exceed_retention") return formatDashboardMessage(locale, "admin.jobsRetentionExceeded");
    if (warning === "rows_exceed_max") return formatDashboardMessage(locale, "admin.jobsRowCapExceeded");
    if (warning === "content_bytes_exceed_cap") return formatDashboardMessage(locale, "admin.jobsBodyCapExceeded");
    return warning;
}
