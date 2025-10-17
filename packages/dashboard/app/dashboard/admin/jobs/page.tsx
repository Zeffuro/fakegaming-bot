"use client";
import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { api, type JobRunEntry } from "@/lib/api-client";
import {
    Alert,
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
    TextField,
    Typography,
    Checkbox,
    FormControlLabel,
    Card,
    CardContent,
    Divider,
} from "@mui/material";

interface TriggerResult {
    ok: boolean;
    jobId?: string | number;
    error?: string;
}

interface JobInfo { name: string; supportsDate: boolean; supportsForce: boolean }

export default function AdminJobsPage() {
    const { isAdmin, loading, error } = useDashboardData();

    const fallbackJobs: JobInfo[] = useMemo(() => ([
        { name: 'birthdays', supportsDate: true, supportsForce: true },
        { name: 'heartbeat', supportsDate: false, supportsForce: false },
    ]), []);

    const [jobs, setJobs] = useState<JobInfo[]>(fallbackJobs);
    const [selectedJob, setSelectedJob] = useState<string>('birthdays');
    const [date, setDate] = useState<string>('');
    const [force, setForce] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<TriggerResult | null>(null);

    const [lastHeartbeat, setLastHeartbeat] = useState<{ startedAt: string; backend: string; receivedAt: string } | null>(null);
    const [loadingHeartbeat, setLoadingHeartbeat] = useState<boolean>(false);

    const [runs, setRuns] = useState<JobRunEntry[]>([]);
    const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

    const [birthdaysToday, setBirthdaysToday] = useState<number | null>(null);
    const [loadingBirthdaysToday, setLoadingBirthdaysToday] = useState<boolean>(false);

    const selectedMeta = useMemo(() => jobs.find(j => j.name === selectedJob), [jobs, selectedJob]);

    const loadJobs = async () => {
        try {
            const res = await api.getJobs();
            if (Array.isArray(res.jobs) && res.jobs.length > 0) {
                setJobs(res.jobs);
                if (!res.jobs.some(j => j.name === selectedJob)) {
                    setSelectedJob(res.jobs[0]?.name ?? 'birthdays');
                }
            }
        } catch {
            // keep fallback list
        }
    };

    const loadLastHeartbeat = async () => {
        try {
            setLoadingHeartbeat(true);
            const res = await api.getLastHeartbeat();
            setLastHeartbeat(res.last ?? null);
        } catch {
            // ignore errors
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
        setDate('');
    };

    const handleTrigger = async () => {
        setSubmitting(true);
        setResult(null);
        try {
            const iso = date ? new Date(date).toISOString() : undefined;
            const res = await api.triggerJob(selectedJob, iso, selectedMeta?.supportsForce ? force : undefined);
            setResult({ ok: true, jobId: res.jobId });
            // Refresh status after a short delay to allow worker to process
            setTimeout(() => { void loadStatus(selectedJob); }, 500);
            if (selectedJob === 'heartbeat') {
                setTimeout(() => { void loadLastHeartbeat(); }, 300);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setResult({ ok: false, error: message });
        } finally {
            setSubmitting(false);
        }
    };

    const renderRunSummary = (r: JobRunEntry, idx: number) => {
        const finished = new Date(r.finishedAt).toLocaleString();
        const status = r.ok ? 'Success' : 'Failed';
        let details: string | null = null;
        if (selectedJob === 'birthdays' && r.meta && typeof r.meta === 'object') {
            const processed = (r.meta as Record<string, unknown>).processed;
            const forceFlag = (r.meta as Record<string, unknown>).force;
            details = `processed: ${typeof processed === 'number' ? processed : 0}${forceFlag ? ' (force)' : ''}`;
        } else if (selectedJob === 'heartbeat' && r.meta && typeof r.meta === 'object') {
            const backend = (r.meta as Record<string, unknown>).backend;
            details = `backend: ${typeof backend === 'string' ? backend : ''}`;
        }
        return (
            <Stack key={idx} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                <Typography variant="body2">{status} · {finished}</Typography>
                {details && <Typography variant="body2" color="text.secondary">{details}</Typography>}
            </Stack>
        );
    };

    if (error) {
        return (
            <DashboardLayout>
                <Alert severity="error">{error}</Alert>
            </DashboardLayout>
        );
    }

    if (!loading && !isAdmin) {
        return (
            <DashboardLayout>
                <Alert severity="warning">You do not have access to Admin tools.</Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout loading={loading} currentTrail={[{ label: 'Admin', href: '/dashboard' }, { label: 'Jobs', href: '/dashboard/admin/jobs' }]}>
            {!loading && (
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Admin Jobs</Typography>

                    <Stack spacing={3} sx={{ maxWidth: 700 }}>
                        <FormControl fullWidth>
                            <InputLabel id="job-select-label">Job</InputLabel>
                            <Select
                                labelId="job-select-label"
                                id="job-select"
                                value={selectedJob}
                                label="Job"
                                onChange={handleJobChange}
                            >
                                {jobs.map(j => (
                                    <MenuItem key={j.name} value={j.name}>{j.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedMeta?.supportsDate && (
                            <TextField
                                label="Date (optional)"
                                type="datetime-local"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                helperText="If set, process for this date/time; otherwise, uses now"
                                slotProps={{ inputLabel: { shrink: true } }}
                                fullWidth
                            />
                        )}

                        {selectedMeta?.supportsForce && (
                            <FormControlLabel
                                control={<Checkbox checked={force} onChange={(_e, checked) => setForce(checked)} />}
                                label="Force (bypass idempotency if supported)"
                            />
                        )}

                        <Stack direction="row" spacing={2}>
                            <Button variant="contained" color="primary" onClick={handleTrigger} disabled={submitting}>
                                {submitting ? 'Triggering…' : 'Trigger Job'}
                            </Button>
                            <Button variant="outlined" onClick={() => { setDate(''); setForce(false); setResult(null); }} disabled={submitting}>Reset</Button>
                        </Stack>

                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="h6">Heartbeat</Typography>
                                    <Button size="small" onClick={() => void loadLastHeartbeat()} disabled={loadingHeartbeat}>Refresh</Button>
                                </Stack>
                                {lastHeartbeat ? (
                                    <>
                                        <Typography variant="body2">Received at: {new Date(lastHeartbeat.receivedAt).toLocaleString()}</Typography>
                                        <Typography variant="body2">Worker started at: {new Date(lastHeartbeat.startedAt).toLocaleString()}</Typography>
                                        <Typography variant="body2">Backend: {lastHeartbeat.backend}</Typography>
                                    </>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No heartbeat observed yet.</Typography>
                                )}
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="h6">Birthdays today</Typography>
                                    <Button size="small" onClick={() => void loadBirthdaysToday()} disabled={loadingBirthdaysToday}>Refresh</Button>
                                </Stack>
                                {birthdaysToday !== null ? (
                                    <Typography variant="body2">Processed: {birthdaysToday}</Typography>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No data yet.</Typography>
                                )}
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="h6">Recent runs — {selectedJob}</Typography>
                                    <Button size="small" onClick={() => void loadStatus(selectedJob)} disabled={loadingStatus}>Refresh</Button>
                                </Stack>
                                {runs.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">No recent runs.</Typography>
                                ) : (
                                    <>
                                        {runs.map((r, idx) => (
                                            <React.Fragment key={idx}>
                                                {idx > 0 && <Divider sx={{ my: 0.5 }} />}
                                                {renderRunSummary(r, idx)}
                                            </React.Fragment>
                                        ))}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {result && result.ok && (
                            <Alert severity="success">Scheduled! Job ID: {String(result.jobId)}</Alert>
                        )}
                        {result && !result.ok && (
                            <Alert severity="error">Failed: {result.error}</Alert>
                        )}
                    </Stack>
                </Box>
            )}
        </DashboardLayout>
    );
}
