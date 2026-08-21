import type { IntegrationHealthRecord } from "@/lib/api-client";
import { formatDashboardMessage } from "@/lib/i18n/messages";
import { getDashboardIntlLocale, type DashboardLocale } from "@/lib/i18n/localeStore";

export type AdminProviderCooldownState = "paused" | "retry" | "active" | "suppressed" | "configured";

export interface AdminProviderCooldownHint {
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    state: AdminProviderCooldownState;
    until?: string;
}

export function getAdminProviderCooldownHint(
    record: IntegrationHealthRecord,
    nowMs = Date.now(),
    locale: DashboardLocale = "en",
): AdminProviderCooldownHint | null {
    const t = (key: `admin.helperCopy.cooldown.${string}`, values?: Record<string, string | number>) =>
        formatDashboardMessage(locale, key as Parameters<typeof formatDashboardMessage>[1], values);
    const metadata = record.metadata ?? {};
    const paused = readBoolean(metadata.paused);
    if (record.status === "paused" || paused === true) {
        return {
            id: "paused",
            title: t("admin.helperCopy.cooldown.paused.title"),
            summary: t("admin.helperCopy.cooldown.paused.summary"),
            nextStep: t("admin.helperCopy.cooldown.paused.nextStep"),
            state: "paused",
        };
    }

    const retryAt = readDate(metadata.nextRetryAt ?? metadata.retryAt ?? metadata.retryAfterUntil);
    if (retryAt && retryAt.getTime() > nowMs) {
        return {
            id: "retry-scheduled",
            title: t("admin.helperCopy.cooldown.retry.title"),
            summary: t("admin.helperCopy.cooldown.retry.summary", { date: formatDateValue(retryAt, locale) }),
            nextStep: t("admin.helperCopy.cooldown.retry.nextStep"),
            state: "retry",
            until: retryAt.toISOString(),
        };
    }

    const cooldownUntil = readDate(metadata.cooldownUntil);
    const cooldownActive = readBoolean(metadata.cooldownActive);
    if (cooldownUntil && (cooldownUntil.getTime() > nowMs || cooldownActive === true)) {
        return {
            id: "notification-cooldown-active",
            title: t("admin.helperCopy.cooldown.active.title"),
            summary: t("admin.helperCopy.cooldown.active.summary", { date: formatDateValue(cooldownUntil, locale) }),
            nextStep: t("admin.helperCopy.cooldown.active.nextStep"),
            state: "active",
            until: cooldownUntil.toISOString(),
        };
    }

    if (readBoolean(metadata.suppressedByCooldown) === true) {
        return {
            id: "notification-cooldown-suppressed",
            title: t("admin.helperCopy.cooldown.suppressed.title"),
            summary: t("admin.helperCopy.cooldown.suppressed.summary"),
            nextStep: t("admin.helperCopy.cooldown.suppressed.nextStep"),
            state: "suppressed",
        };
    }

    const cooldownMinutes = readNonNegativeInteger(metadata.cooldownMinutes);
    if (cooldownMinutes !== null && cooldownMinutes > 0) {
        const lastNotifiedAt = readDate(metadata.lastNotifiedAt);
        const lastNotifiedText = lastNotifiedAt
            ? t("admin.helperCopy.cooldown.configured.lastDelivery", { date: formatDateValue(lastNotifiedAt, locale) })
            : "";
        return {
            id: "notification-cooldown-configured",
            title: t("admin.helperCopy.cooldown.configured.title"),
            summary: t("admin.helperCopy.cooldown.configured.summary", { minutes: cooldownMinutes, lastDelivery: lastNotifiedText }),
            nextStep: t("admin.helperCopy.cooldown.configured.nextStep"),
            state: "configured",
        };
    }

    return null;
}

export function formatAdminProviderCooldownSummary(
    hint: AdminProviderCooldownHint | null,
    locale: DashboardLocale = "en",
): string | null {
    if (!hint) return null;
    return formatDashboardMessage(
        locale,
        `admin.helperCopy.cooldown.summary.${hint.state}`,
        hint.until ? { until: hint.until } : undefined,
    );
}

function formatDateValue(value: Date, locale: DashboardLocale): string {
    if (locale === "en") return value.toISOString();
    return new Intl.DateTimeFormat(getDashboardIntlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function readBoolean(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") return true;
        if (normalized === "false" || normalized === "0") return false;
    }
    return null;
}

function readNonNegativeInteger(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
}

function readDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== "string" && typeof value !== "number") return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
