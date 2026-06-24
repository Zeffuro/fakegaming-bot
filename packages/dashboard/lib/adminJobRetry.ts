import type { JobRunEntry } from "@/lib/api/jobs";

export interface AdminJobRetryCapabilities {
    supportsDate: boolean;
    supportsForce: boolean;
}

export interface AdminJobRetryPayload {
    date?: string;
    force?: boolean;
}

export function canRetryAdminJobRun(run: JobRunEntry): boolean {
    return run.ok === false;
}

export function buildAdminJobRetryPayload(job: AdminJobRetryCapabilities, run: JobRunEntry): AdminJobRetryPayload {
    const payload: AdminJobRetryPayload = {};

    if (job.supportsDate) {
        const date = normalizeIsoDate(run.meta?.date);
        if (date) payload.date = date;
    }

    if (job.supportsForce && run.meta?.force === true) {
        payload.force = true;
    }

    return payload;
}

function normalizeIsoDate(value: unknown): string | undefined {
    if (typeof value !== "string" || value.trim().length === 0) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
}
