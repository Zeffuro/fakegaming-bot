import type { JobRunEntry } from "@/lib/api/jobs";

export function getAdminJobRunDetails(run: JobRunEntry, selectedJob: string): string | null {
    if (typeof run.error === "string" && run.error.length > 0) {
        return run.error;
    }

    if (!run.meta || typeof run.meta !== "object") return null;

    if (selectedJob === "birthdays") {
        const processed = readNumber(run.meta.processed) ?? 0;
        return `processed: ${processed}${run.meta.force === true ? " (force)" : ""}`;
    }

    if (selectedJob === "heartbeat") {
        const backend = readString(run.meta.backend);
        return backend ? `backend: ${backend}` : null;
    }

    if (selectedJob === "twitch") {
        return getTwitchRunDetails(run);
    }

    const processed = readNumber(run.meta.processed);
    const errors = readNumber(run.meta.errors);
    if (processed !== null || errors !== null) {
        return `processed: ${processed ?? 0}, errors: ${errors ?? 0}`;
    }

    return null;
}

function getTwitchRunDetails(run: JobRunEntry): string | null {
    const meta = run.meta;
    if (!meta || typeof meta !== "object") return null;

    if (readString(meta.job) === "vod-followup") {
        const status = formatVodFollowupStatus(readString(meta.status));
        const username = readString(meta.username);
        const vodId = readString(meta.vodId);
        const parts = [
            "VOD follow-up",
            status,
            username ? `@${username}` : null,
            vodId ? `vod ${vodId}` : null,
        ].filter((part): part is string => typeof part === "string" && part.length > 0);
        return parts.join(": ");
    }

    const processed = readNumber(meta.processed) ?? 0;
    const errors = readNumber(meta.errors) ?? 0;
    const scheduled = readNumber(meta.vodFollowupsScheduled) ?? 0;
    const scheduleErrors = readNumber(meta.vodFollowupScheduleErrors) ?? 0;
    return `processed: ${processed}, errors: ${errors}, VOD scheduled: ${scheduled}${scheduleErrors > 0 ? `, VOD schedule errors: ${scheduleErrors}` : ""}`;
}

function formatVodFollowupStatus(value: string | null): string {
    if (value === "config_missing") return "config missing";
    if (value === "disabled") return "disabled";
    if (value === "user_missing") return "user missing";
    if (value === "no_archive_video") return "no archive yet";
    if (value === "duplicate_last_vod") return "already stored";
    if (value === "duplicate_notification") return "already notified";
    if (value === "notified") return "notified";
    if (value === "send_failed") return "send failed";
    if (value === "error") return "error";
    return value ?? "unknown";
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
