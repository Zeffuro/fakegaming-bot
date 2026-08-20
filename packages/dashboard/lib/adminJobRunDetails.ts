import type { JobRunEntry } from "@/lib/api/jobs";
import type { DashboardLocale } from "@/lib/i18n/localeStore";
import { formatDashboardMessage } from "@/lib/i18n/messages";

export function getAdminJobRunDetails(
    run: JobRunEntry,
    selectedJob: string,
    locale: DashboardLocale = "en",
): string | null {
    if (typeof run.error === "string" && run.error.length > 0) {
        return run.error;
    }

    if (!run.meta || typeof run.meta !== "object") return null;

    if (selectedJob === "birthdays") {
        const processed = readNumber(run.meta.processed) ?? 0;
        return formatDashboardMessage(locale, "admin.jobsDetailProcessed", {
            count: processed,
            force: run.meta.force === true ? formatDashboardMessage(locale, "admin.jobsDetailForced") : "",
        });
    }

    if (selectedJob === "heartbeat") {
        const backend = readString(run.meta.backend);
        return backend ? formatDashboardMessage(locale, "admin.jobsDetailBackend", { backend }) : null;
    }

    if (selectedJob === "twitch") {
        return getTwitchRunDetails(run, locale);
    }

    const processed = readNumber(run.meta.processed);
    const errors = readNumber(run.meta.errors);
    if (processed !== null || errors !== null) {
        return formatDashboardMessage(locale, "admin.jobsDetailProcessedErrors", {
            processed: processed ?? 0,
            errors: errors ?? 0,
        });
    }

    return null;
}

function getTwitchRunDetails(run: JobRunEntry, locale: DashboardLocale): string | null {
    const meta = run.meta;
    if (!meta || typeof meta !== "object") return null;

    if (readString(meta.job) === "vod-followup") {
        const status = formatVodFollowupStatus(readString(meta.status), locale);
        const username = readString(meta.username);
        const vodId = readString(meta.vodId);
        const parts = [
            formatDashboardMessage(locale, "admin.jobsDetailVodFollowup"),
            status,
            username ? `@${username}` : null,
            vodId ? formatDashboardMessage(locale, "admin.jobsDetailVod", { id: vodId }) : null,
        ].filter((part): part is string => typeof part === "string" && part.length > 0);
        return parts.join(": ");
    }

    const processed = readNumber(meta.processed) ?? 0;
    const errors = readNumber(meta.errors) ?? 0;
    const scheduled = readNumber(meta.vodFollowupsScheduled) ?? 0;
    const scheduleErrors = readNumber(meta.vodFollowupScheduleErrors) ?? 0;
    return formatDashboardMessage(locale, "admin.jobsDetailVodScheduled", {
        processed,
        errors,
        scheduled,
        scheduleErrors: scheduleErrors > 0
            ? formatDashboardMessage(locale, "admin.jobsDetailVodScheduleErrors", { count: scheduleErrors })
            : "",
    });
}

function formatVodFollowupStatus(value: string | null, locale: DashboardLocale): string {
    if (value === "config_missing") return formatDashboardMessage(locale, "admin.jobsVodConfigMissing");
    if (value === "disabled") return formatDashboardMessage(locale, "admin.jobsVodDisabled");
    if (value === "user_missing") return formatDashboardMessage(locale, "admin.jobsVodUserMissing");
    if (value === "no_archive_video") return formatDashboardMessage(locale, "admin.jobsVodNoArchive");
    if (value === "duplicate_last_vod") return formatDashboardMessage(locale, "admin.jobsVodStored");
    if (value === "duplicate_notification") return formatDashboardMessage(locale, "admin.jobsVodNotifiedAlready");
    if (value === "notified") return formatDashboardMessage(locale, "admin.jobsVodNotified");
    if (value === "send_failed") return formatDashboardMessage(locale, "admin.jobsVodSendFailed");
    if (value === "error") return formatDashboardMessage(locale, "admin.jobsVodError");
    return value ?? formatDashboardMessage(locale, "admin.jobsVodUnknown");
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
