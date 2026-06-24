import type { IntegrationHealthRecord } from "@/lib/api-client";

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
    nowMs = Date.now()
): AdminProviderCooldownHint | null {
    const metadata = record.metadata ?? {};
    const paused = readBoolean(metadata.paused);
    if (record.status === "paused" || paused === true) {
        return {
            id: "paused",
            title: "Integration paused",
            summary: "This config is paused and provider polling skips delivery work for it.",
            nextStep: "Resume the config when notifications should continue.",
            state: "paused",
        };
    }

    const retryAt = readDate(metadata.nextRetryAt ?? metadata.retryAt ?? metadata.retryAfterUntil);
    if (retryAt && retryAt.getTime() > nowMs) {
        return {
            id: "retry-scheduled",
            title: "Retry scheduled",
            summary: `The next retry is scheduled for ${retryAt.toISOString()}.`,
            nextStep: "Wait for the retry window before manually changing the integration.",
            state: "retry",
            until: retryAt.toISOString(),
        };
    }

    const cooldownUntil = readDate(metadata.cooldownUntil);
    const cooldownActive = readBoolean(metadata.cooldownActive);
    if (cooldownUntil && (cooldownUntil.getTime() > nowMs || cooldownActive === true)) {
        return {
            id: "notification-cooldown-active",
            title: "Notification cooldown active",
            summary: `Notifications are held until ${cooldownUntil.toISOString()}.`,
            nextStep: "No action is needed unless this config keeps missing expected notifications after the cooldown ends.",
            state: "active",
            until: cooldownUntil.toISOString(),
        };
    }

    if (readBoolean(metadata.suppressedByCooldown) === true) {
        return {
            id: "notification-cooldown-suppressed",
            title: "Notification cooldown suppressed delivery",
            summary: "The last provider check found new content, but the config cooldown suppressed delivery.",
            nextStep: "Review the configured cooldown if this integration should announce more frequently.",
            state: "suppressed",
        };
    }

    const cooldownMinutes = readNonNegativeInteger(metadata.cooldownMinutes);
    if (cooldownMinutes !== null && cooldownMinutes > 0) {
        const lastNotifiedAt = readDate(metadata.lastNotifiedAt);
        const lastNotifiedText = lastNotifiedAt ? ` Last delivery metadata: ${lastNotifiedAt.toISOString()}.` : "";
        return {
            id: "notification-cooldown-configured",
            title: "Notification cooldown configured",
            summary: `${cooldownMinutes} ${cooldownMinutes === 1 ? "minute" : "minutes"} between deliveries.${lastNotifiedText}`,
            nextStep: "Cooldown is configured but not currently blocking delivery based on the latest health metadata.",
            state: "configured",
        };
    }

    return null;
}

export function formatAdminProviderCooldownSummary(hint: AdminProviderCooldownHint | null): string | null {
    if (!hint) return null;
    if (hint.state === "paused") return "State: paused by config";
    if (hint.state === "retry" && hint.until) return `Retry: scheduled for ${hint.until}`;
    if (hint.state === "active" && hint.until) return `Cooldown: active until ${hint.until}`;
    if (hint.state === "suppressed") return "Cooldown: last delivery suppressed";
    return "Cooldown: configured";
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
