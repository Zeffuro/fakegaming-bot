import { API_ENDPOINTS, apiRequest } from "./core";

export interface JobsListResponse {
    jobs: Array<{ name: string; supportsDate: boolean; supportsForce: boolean }>;
}

export interface LastHeartbeatResponse {
    last: { startedAt: string; backend: string; receivedAt: string } | null;
}

export interface JobRunEntry {
    startedAt: string;
    finishedAt: string;
    ok: boolean;
    meta?: Record<string, unknown>;
    error?: string;
}

export interface PatchNotesStorageGameSummary {
    contentBytes: number;
    game: string;
    newestPublishedAt: number | null;
    oldestPublishedAt: number | null;
    rows: number;
    warnings: string[];
}

export interface PatchNotesStorageSummary {
    games: PatchNotesStorageGameSummary[];
    generatedAt: string;
    lastScan: {
        error?: string;
        finishedAt: string;
        historyPrunedRows: number;
        historyTruncated: number;
        ok: boolean;
        startedAt: string;
    } | null;
    retention: {
        cutoffPublishedAt: number;
        maxBodyBytes: number;
        maxRowsPerGame: number;
        retentionDays: number;
    };
    totalContentBytes: number;
    totalRows: number;
    warnings: string[];
}

export const jobsApi = {
    triggerJob: (name: string, date?: string, force?: boolean) =>
        apiRequest<{ ok: boolean; jobId: string | number }>(
            `${API_ENDPOINTS.JOBS}/${encodeURIComponent(name)}/run`,
            { method: "POST", body: { ...(date ? { date } : {}), ...(typeof force === "boolean" ? { force } : {}) } },
        ),

    getJobs: () => apiRequest<JobsListResponse>(API_ENDPOINTS.JOBS),

    getLastHeartbeat: () => apiRequest<LastHeartbeatResponse>(`${API_ENDPOINTS.JOBS}/heartbeat/last`),

    getJobStatus: (name: string) =>
        apiRequest<{ runs: JobRunEntry[] }>(`${API_ENDPOINTS.JOBS}/${encodeURIComponent(name)}/status`),

    getBirthdaysProcessedToday: () =>
        apiRequest<{ processed: number }>(`${API_ENDPOINTS.JOBS}/birthdays/today`),

    getPatchNotesStorage: () =>
        apiRequest<PatchNotesStorageSummary>(`${API_ENDPOINTS.JOBS}/patchnotes/storage`),
};
