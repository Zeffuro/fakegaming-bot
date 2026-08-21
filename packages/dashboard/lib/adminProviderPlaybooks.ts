import { formatDashboardMessage } from "@/lib/i18n/messages";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

export interface AdminProviderPlaybookInput {
    provider?: string | null;
    status?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    consecutiveFailures?: number | null;
}

export interface AdminProviderPlaybookHint {
    id: string;
    title: string;
    summary: string;
    nextStep: string;
    urgency: "critical" | "warning" | "info";
}

interface PlaybookRule {
    id: string;
    codes?: string[];
    providers?: string[];
    messagePatterns?: RegExp[];
    urgency?: AdminProviderPlaybookHint["urgency"];
}

const explicitRules: PlaybookRule[] = [
    {
        id: "twitch-auth",
        codes: ["TWITCH_AUTH_FAILED"],
        urgency: "critical",
    },
    {
        id: "twitch-user-not-found",
        codes: ["TWITCH_USER_NOT_FOUND"],
    },
    {
        id: "youtube-feed-unavailable",
        codes: ["YOUTUBE_FEED_UNAVAILABLE"],
    },
    {
        id: "tiktok-resolve-failed",
        codes: ["TIKTOK_RESOLVE_FAILED", "TIKTOK_CONNECT_FAILED"],
        urgency: "warning",
    },
    {
        id: "tiktok-auth-required",
        codes: ["TIKTOK_AUTH_REQUIRED"],
        urgency: "critical",
    },
    {
        id: "tiktok-rate-limited",
        codes: ["TIKTOK_RATE_LIMITED"],
        urgency: "warning",
    },
    {
        id: "tiktok-user-not-found",
        codes: ["TIKTOK_USER_NOT_FOUND"],
        urgency: "warning",
    },
    {
        id: "bluesky-feed-unavailable",
        codes: ["BLUESKY_FEED_UNAVAILABLE"],
    },
    {
        id: "patch-update-failed",
        codes: ["PATCH_SUBSCRIPTION_UPDATE_FAILED"],
        urgency: "critical",
    },
    {
        id: "discord-send-failed",
        codes: ["DISCORD_SEND_FAILED"],
    },
    {
        id: "steam-news-poll-failed",
        codes: ["STEAM_NEWS_POLL_FAILED"],
    },
];

const fallbackRules: PlaybookRule[] = [
    {
        id: "auth",
        messagePatterns: [/auth/i, /token/i, /unauthori[sz]ed/i, /forbidden/i, /\b401\b/, /\b403\b/],
        urgency: "critical",
    },
    {
        id: "rate-limit",
        messagePatterns: [/rate.?limit/i, /too many requests/i, /\b429\b/, /quota/i],
    },
    {
        id: "not-found",
        messagePatterns: [/not found/i, /\b404\b/, /unknown user/i, /unknown channel/i],
    },
    {
        id: "network",
        messagePatterns: [/timeout/i, /timed out/i, /network/i, /fetch/i, /unavailable/i, /\b5\d\d\b/],
    },
    {
        id: "discord",
        messagePatterns: [/discord/i, /missing permissions/i, /channel/i, /message/i],
    },
];

export function getAdminProviderPlaybookHint(
    input: AdminProviderPlaybookInput,
    locale: DashboardLocale = "en",
): AdminProviderPlaybookHint | null {
    const code = normalizeKey(input.lastErrorCode);
    const provider = normalizeKey(input.provider);
    const message = input.lastErrorMessage ?? "";

    const explicitRule = explicitRules.find(rule => ruleMatches(rule, { code, provider, message }));
    if (explicitRule) return toHint(explicitRule, input, locale);

    const fallbackRule = fallbackRules.find(rule => ruleMatches(rule, { code, provider, message }));
    if (fallbackRule) return toHint(fallbackRule, input, locale);

    if (input.status === "unknown") {
        return createLocalizedHint("unknown-status", "info", locale);
    }

    return null;
}

export function formatAdminProviderPlaybookSummary(
    hint: AdminProviderPlaybookHint | null,
    locale: DashboardLocale = "en",
): string | null {
    return hint
        ? formatDashboardMessage(locale, "admin.helperCopy.playbooks.nextStepSummary", { nextStep: hint.nextStep })
        : null;
}

function ruleMatches(rule: PlaybookRule, input: { code: string; provider: string; message: string }): boolean {
    if (rule.codes?.some(code => normalizeKey(code) === input.code)) return true;
    if (rule.providers?.some(provider => normalizeKey(provider) === input.provider)) return true;
    if (rule.messagePatterns?.some(pattern => pattern.test(input.message) || pattern.test(input.code))) return true;
    return false;
}

function toHint(
    rule: PlaybookRule,
    input: AdminProviderPlaybookInput,
    locale: DashboardLocale,
): AdminProviderPlaybookHint {
    const consecutiveFailures = Math.max(0, Number(input.consecutiveFailures ?? 0));
    const urgency = rule.urgency ?? (consecutiveFailures >= 3 ? "critical" : "warning");
    return createLocalizedHint(rule.id, urgency, locale);
}

function createLocalizedHint(
    id: string,
    urgency: AdminProviderPlaybookHint["urgency"],
    locale: DashboardLocale,
): AdminProviderPlaybookHint {
    const key = (field: "title" | "summary" | "nextStep") =>
        `admin.helperCopy.playbooks.${id}.${field}` as Parameters<typeof formatDashboardMessage>[1];
    return {
        id,
        title: formatDashboardMessage(locale, key("title")),
        summary: formatDashboardMessage(locale, key("summary")),
        nextStep: formatDashboardMessage(locale, key("nextStep")),
        urgency,
    };
}

function normalizeKey(value: string | null | undefined): string {
    return (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}
