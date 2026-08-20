import type { IntegrationHealthRecord } from "@/lib/api-client";
import {
    getDashboardIntlLocale,
    getDashboardLocaleValue,
    type DashboardLocale,
    type DashboardLocaleValues,
} from "@/lib/i18n/localeStore";

export type AdminProviderCooldownState = "paused" | "retry" | "active" | "suppressed" | "configured";

export interface AdminProviderCooldownHint {
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    state: AdminProviderCooldownState;
    until?: string;
}

interface CooldownCopy {
    paused: Pick<AdminProviderCooldownHint, "title" | "summary" | "nextStep">;
    retry: {
        title: string;
        summary: (retryAt: Date) => string;
        nextStep: string;
    };
    active: {
        title: string;
        summary: (cooldownUntil: Date) => string;
        nextStep: string;
    };
    suppressed: Pick<AdminProviderCooldownHint, "title" | "summary" | "nextStep">;
    configured: {
        title: string;
        lastDelivery: (lastNotifiedAt: Date) => string;
        summary: (minutes: number, lastDelivery: string) => string;
        nextStep: string;
    };
    summary: Record<AdminProviderCooldownState, (until?: string) => string>;
}

const cooldownCopy = {
    en: {
        paused: {
            title: "Integration paused",
            summary: "This config is paused and provider polling skips delivery work for it.",
            nextStep: "Resume the config when notifications should continue.",
        },
        retry: {
            title: "Retry scheduled",
            summary: (retryAt) => `The next retry is scheduled for ${retryAt.toISOString()}.`,
            nextStep: "Wait for the retry window before manually changing the integration.",
        },
        active: {
            title: "Notification cooldown active",
            summary: (cooldownUntil) => `Notifications are held until ${cooldownUntil.toISOString()}.`,
            nextStep: "No action is needed unless this config keeps missing expected notifications after the cooldown ends.",
        },
        suppressed: {
            title: "Notification cooldown suppressed delivery",
            summary: "The last provider check found new content, but the config cooldown suppressed delivery.",
            nextStep: "Review the configured cooldown if this integration should announce more frequently.",
        },
        configured: {
            title: "Notification cooldown configured",
            lastDelivery: (lastNotifiedAt) => ` Last delivery metadata: ${lastNotifiedAt.toISOString()}.`,
            summary: (minutes, lastDelivery) => `${minutes} ${minutes === 1 ? "minute" : "minutes"} between deliveries.${lastDelivery}`,
            nextStep: "Cooldown is configured but not currently blocking delivery based on the latest health metadata.",
        },
        summary: {
            paused: () => "State: paused by config",
            retry: (until) => `Retry: scheduled for ${until}`,
            active: (until) => `Cooldown: active until ${until}`,
            suppressed: () => "Cooldown: last delivery suppressed",
            configured: () => "Cooldown: configured",
        },
    },
    nl: {
        paused: {
            title: "Integratie gepauzeerd",
            summary: "Deze configuratie is gepauzeerd en wordt bij providercontroles overgeslagen.",
            nextStep: "Hervat de configuratie wanneer meldingen weer moeten worden bezorgd.",
        },
        retry: {
            title: "Nieuwe poging gepland",
            summary: (retryAt) => `De volgende poging is gepland voor ${formatDate(retryAt, "nl")}.`,
            nextStep: "Wacht tot de volgende poging voordat je de integratie handmatig wijzigt.",
        },
        active: {
            title: "Afkoelperiode voor meldingen actief",
            summary: (cooldownUntil) => `Meldingen worden tegengehouden tot ${formatDate(cooldownUntil, "nl")}.`,
            nextStep: "Er is geen actie nodig, tenzij na de afkoelperiode nog steeds verwachte meldingen ontbreken.",
        },
        suppressed: {
            title: "Afkoelperiode heeft bezorging onderdrukt",
            summary: "Bij de laatste providercontrole is nieuwe inhoud gevonden, maar de afkoelperiode heeft bezorging onderdrukt.",
            nextStep: "Controleer de ingestelde afkoelperiode als deze integratie vaker meldingen moet plaatsen.",
        },
        configured: {
            title: "Afkoelperiode voor meldingen ingesteld",
            lastDelivery: (lastNotifiedAt) => ` Metadata van laatste bezorging: ${formatDate(lastNotifiedAt, "nl")}.`,
            summary: (minutes, lastDelivery) => `${minutes} ${minutes === 1 ? "minuut" : "minuten"} tussen bezorgingen.${lastDelivery}`,
            nextStep: "De afkoelperiode is ingesteld, maar blokkeert volgens de nieuwste statusmetadata momenteel geen bezorging.",
        },
        summary: {
            paused: () => "Status: gepauzeerd via configuratie",
            retry: (until) => `Nieuwe poging: gepland voor ${until}`,
            active: (until) => `Afkoelperiode: actief tot ${until}`,
            suppressed: () => "Afkoelperiode: laatste bezorging onderdrukt",
            configured: () => "Afkoelperiode: ingesteld",
        },
    },
} satisfies DashboardLocaleValues<CooldownCopy>;

export function getAdminProviderCooldownHint(
    record: IntegrationHealthRecord,
    nowMs = Date.now(),
    locale: DashboardLocale = "en",
): AdminProviderCooldownHint | null {
    const copy = getDashboardLocaleValue(locale, cooldownCopy);
    const metadata = record.metadata ?? {};
    const paused = readBoolean(metadata.paused);
    if (record.status === "paused" || paused === true) {
        return {
            id: "paused",
            ...copy.paused,
            state: "paused",
        };
    }

    const retryAt = readDate(metadata.nextRetryAt ?? metadata.retryAt ?? metadata.retryAfterUntil);
    if (retryAt && retryAt.getTime() > nowMs) {
        return {
            id: "retry-scheduled",
            title: copy.retry.title,
            summary: copy.retry.summary(retryAt),
            nextStep: copy.retry.nextStep,
            state: "retry",
            until: retryAt.toISOString(),
        };
    }

    const cooldownUntil = readDate(metadata.cooldownUntil);
    const cooldownActive = readBoolean(metadata.cooldownActive);
    if (cooldownUntil && (cooldownUntil.getTime() > nowMs || cooldownActive === true)) {
        return {
            id: "notification-cooldown-active",
            title: copy.active.title,
            summary: copy.active.summary(cooldownUntil),
            nextStep: copy.active.nextStep,
            state: "active",
            until: cooldownUntil.toISOString(),
        };
    }

    if (readBoolean(metadata.suppressedByCooldown) === true) {
        return {
            id: "notification-cooldown-suppressed",
            ...copy.suppressed,
            state: "suppressed",
        };
    }

    const cooldownMinutes = readNonNegativeInteger(metadata.cooldownMinutes);
    if (cooldownMinutes !== null && cooldownMinutes > 0) {
        const lastNotifiedAt = readDate(metadata.lastNotifiedAt);
        const lastNotifiedText = lastNotifiedAt
            ? copy.configured.lastDelivery(lastNotifiedAt)
            : "";
        return {
            id: "notification-cooldown-configured",
            title: copy.configured.title,
            summary: copy.configured.summary(cooldownMinutes, lastNotifiedText),
            nextStep: copy.configured.nextStep,
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
    return getDashboardLocaleValue(locale, cooldownCopy).summary[hint.state](hint.until);
}

function formatDate(value: Date, locale: DashboardLocale): string {
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
