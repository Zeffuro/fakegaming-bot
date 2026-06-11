"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import {
    dashboardAccents,
    dashboardFieldSx,
    ghostActionButtonSx,
    primaryActionButtonSx,
} from "@/components/dashboard/dashboardTheme";
import { api, type JobRunEntry } from "@/lib/api-client";
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
    ErrorOutlined,
    Favorite,
    MonitorHeart,
    PlayArrow,
    Refresh,
    RestartAlt,
    Schedule,
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

function formatDateTime(value?: string | null): string {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
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
                    Refresh
                </Button>
            </Stack>
            <Box sx={{ position: "relative", flex: 1 }}>{children}</Box>
        </FeaturePanel>
    );
}

export default function AdminJobsPage() {
    const accent = dashboardAccents.admin;
    const fallbackJobs: JobInfo[] = useMemo(() => ([
        { name: "birthdays", supportsDate: true, supportsForce: true },
        { name: "heartbeat", supportsDate: false, supportsForce: false },
    ]), []);

    const [jobs, setJobs] = useState<JobInfo[]>(fallbackJobs);
    const [selectedJob, setSelectedJob] = useState<string>("birthdays");
    const [date, setDate] = useState<string>("");
    const [force, setForce] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<TriggerResult | null>(null);

    const [lastHeartbeat, setLastHeartbeat] = useState<{ startedAt: string; backend: string; receivedAt: string } | null>(null);
    const [loadingHeartbeat, setLoadingHeartbeat] = useState<boolean>(false);

    const [runs, setRuns] = useState<JobRunEntry[]>([]);
    const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

    const [birthdaysToday, setBirthdaysToday] = useState<number | null>(null);
    const [loadingBirthdaysToday, setLoadingBirthdaysToday] = useState<boolean>(false);

    const selectedMeta = useMemo(() => jobs.find((j) => j.name === selectedJob), [jobs, selectedJob]);

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

    useEffect(() => {
        void loadJobs();
        void loadLastHeartbeat();
        void loadBirthdaysToday();
    }, []);

    useEffect(() => {
        void loadStatus(selectedJob);
    }, [selectedJob]);

    const handleJobChange = (e: SelectChangeEvent<string>) => {
        setSelectedJob(e.target.value as string);
        setResult(null);
        setForce(false);
        setDate("");
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
            const message = err instanceof Error ? err.message : "Unknown error";
            setResult({ ok: false, error: message });
        } finally {
            setSubmitting(false);
        }
    };

    const renderRunSummary = (r: JobRunEntry, idx: number) => {
        const details = getRunDetails(r, selectedJob);

        return (
            <Box key={`${r.finishedAt}-${idx}`} sx={{ position: "relative" }}>
                {idx > 0 && <Divider sx={{ my: 1.2, borderColor: "rgba(255,255,255,0.08)" }} />}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                        {r.ok ? <CheckCircle sx={{ color: dashboardAccents.settings, fontSize: 19 }} /> : <ErrorOutlined sx={{ color: dashboardAccents.quotes, fontSize: 19 }} />}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 760 }}>
                                {r.ok ? "Success" : "Failed"}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
                                {formatDateTime(r.finishedAt)}
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
                </Stack>
            </Box>
        );
    };

    return (
        <AdminPage title="Admin Jobs" trail={[{ label: "Jobs", href: "/dashboard/admin/jobs" }]}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(340px, 0.95fr) minmax(0, 1.55fr)" }, gap: 2.5 }}>
                <FeaturePanel accent={accent} sx={{ p: 3, alignSelf: "start" }}>
                    <Stack spacing={2.4} sx={{ position: "relative" }}>
                        <Stack spacing={0.6}>
                            <Chip
                                icon={<PlayArrow />}
                                label="Manual run"
                                sx={{ alignSelf: "flex-start", bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.42)}` }}
                            />
                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900, letterSpacing: "-0.03em" }}>
                                Trigger a job
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                                Run a worker task without waiting for its schedule. Date and force options only appear for jobs that support them.
                            </Typography>
                        </Stack>

                        <FormControl fullWidth sx={dashboardFieldSx(accent)}>
                            <InputLabel id="job-select-label">Job</InputLabel>
                            <Select
                                labelId="job-select-label"
                                id="job-select"
                                value={selectedJob}
                                label="Job"
                                onChange={handleJobChange}
                            >
                                {jobs.map((job) => (
                                    <MenuItem key={job.name} value={job.name}>{job.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedMeta?.supportsDate && (
                            <TextField
                                label="Date (optional)"
                                type="datetime-local"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                helperText="If set, process for this date/time; otherwise, uses now."
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
                                label="Force run, bypassing idempotency checks"
                                sx={{ color: "rgba(255,255,255,0.70)" }}
                            />
                        )}

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button variant="contained" onClick={handleTrigger} disabled={submitting} startIcon={<PlayArrow />} sx={primaryActionButtonSx(accent)}>
                                {submitting ? "Triggering..." : "Trigger Job"}
                            </Button>
                            <Button variant="outlined" onClick={() => { setDate(""); setForce(false); setResult(null); }} disabled={submitting} startIcon={<RestartAlt />} sx={ghostActionButtonSx(accent)}>
                                Reset
                            </Button>
                        </Stack>

                        {result && result.ok && (
                            <Alert severity="success" sx={{ bgcolor: alpha(dashboardAccents.settings, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.settings, 0.22)}` }}>
                                Scheduled. Job ID: {String(result.jobId)}
                            </Alert>
                        )}
                        {result && !result.ok && (
                            <Alert severity="error" sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}` }}>
                                Failed: {result.error}
                            </Alert>
                        )}
                    </Stack>
                </FeaturePanel>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                    <StatPanel title="Heartbeat" icon={<MonitorHeart />} accent={dashboardAccents.commands} loading={loadingHeartbeat} onRefresh={() => void loadLastHeartbeat()}>
                        {lastHeartbeat ? (
                            <Stack spacing={1.15}>
                                <StatusLine label="Received" value={formatDateTime(lastHeartbeat.receivedAt)} />
                                <StatusLine label="Worker started" value={formatDateTime(lastHeartbeat.startedAt)} />
                                <StatusLine label="Backend" value={lastHeartbeat.backend} />
                            </Stack>
                        ) : (
                            <EmptyStatus icon={<MonitorHeart />} text="No heartbeat observed yet." />
                        )}
                    </StatPanel>

                    <StatPanel title="Birthdays today" icon={<Favorite />} accent={dashboardAccents.birthdays} loading={loadingBirthdaysToday} onRefresh={() => void loadBirthdaysToday()}>
                        {birthdaysToday !== null ? (
                            <Stack spacing={0.8}>
                                <Typography variant="h3" sx={{ color: "grey.50", fontWeight: 950, letterSpacing: "-0.05em" }}>
                                    {birthdaysToday}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                                    birthday notifications processed today.
                                </Typography>
                            </Stack>
                        ) : (
                            <EmptyStatus icon={<Favorite />} text="No birthday processing data yet." />
                        )}
                    </StatPanel>

                    <FeaturePanel accent={accent} sx={{ p: 2.5, gridColumn: { xs: "auto", md: "1 / -1" } }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, position: "relative", mb: 2 }}>
                            <Stack direction="row" spacing={1.1} sx={{ alignItems: "center" }}>
                                <WorkHistory sx={{ color: accent }} />
                                <Box>
                                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.1 }}>
                                        Recent runs
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.75 }}>
                                        <Chip size="small" label={selectedJob} sx={{ bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.34)}` }} />
                                        {selectedMeta?.supportsDate && <Chip size="small" icon={<Schedule />} label="date" sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }} />}
                                        {selectedMeta?.supportsForce && <Chip size="small" label="force" sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }} />}
                                    </Stack>
                                </Box>
                            </Stack>
                            <Button size="small" variant="outlined" onClick={() => void loadStatus(selectedJob)} disabled={loadingStatus} startIcon={<Refresh />} sx={ghostActionButtonSx(accent)}>
                                Refresh
                            </Button>
                        </Stack>

                        {runs.length === 0 ? (
                            <EmptyStatus icon={<WorkHistory />} text="No recent runs for this job." />
                        ) : (
                            <Stack sx={{ position: "relative" }}>
                                {runs.map((run, idx) => renderRunSummary(run, idx))}
                            </Stack>
                        )}
                    </FeaturePanel>
                </Box>
            </Box>
        </AdminPage>
    );
}

function StatusLine({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)", p: 1.25 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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

function getRunDetails(run: JobRunEntry, selectedJob: string): string | null {
    if (typeof run.error === "string" && run.error.length > 0) {
        return run.error;
    }

    if (!run.meta || typeof run.meta !== "object") return null;

    if (selectedJob === "birthdays") {
        const processed = run.meta.processed;
        const forceFlag = run.meta.force;
        return `processed: ${typeof processed === "number" ? processed : 0}${forceFlag ? " (force)" : ""}`;
    }

    if (selectedJob === "heartbeat") {
        const backend = run.meta.backend;
        return typeof backend === "string" && backend.length > 0 ? `backend: ${backend}` : null;
    }

    return null;
}
