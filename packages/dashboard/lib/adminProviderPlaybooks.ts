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
    title: string;
    summary: string;
    nextStep: string;
    urgency?: AdminProviderPlaybookHint["urgency"];
}

const explicitRules: PlaybookRule[] = [
    {
        id: "twitch-auth",
        codes: ["TWITCH_AUTH_FAILED"],
        title: "Twitch auth failed",
        summary: "The worker could not get a Twitch app token.",
        nextStep: "Check Twitch client ID and secret, then confirm the Twitch app is still active.",
        urgency: "critical",
    },
    {
        id: "twitch-user-not-found",
        codes: ["TWITCH_USER_NOT_FOUND"],
        title: "Twitch user not found",
        summary: "The configured Twitch login no longer resolves through Helix.",
        nextStep: "Verify the streamer username and update or pause the config if the account was renamed or removed.",
    },
    {
        id: "youtube-feed-unavailable",
        codes: ["YOUTUBE_FEED_UNAVAILABLE"],
        title: "YouTube feed unavailable",
        summary: "The RSS feed for the configured channel returned no usable items.",
        nextStep: "Verify the YouTube channel ID and check whether the channel feed is public and reachable.",
    },
    {
        id: "tiktok-resolve-failed",
        codes: ["TIKTOK_RESOLVE_FAILED", "TIKTOK_CONNECT_FAILED"],
        title: "TikTok lookup failed",
        summary: "The worker could not resolve the creator live status.",
        nextStep: "Open TikTok diagnostics, verify the username, and review the sanitized session state.",
        urgency: "warning",
    },
    {
        id: "tiktok-auth-required",
        codes: ["TIKTOK_AUTH_REQUIRED"],
        title: "TikTok session likely required",
        summary: "TikTok appears to require fresh session material for this lookup.",
        nextStep: "Refresh the operator-managed TikTok session cookie and confirm diagnostics show a likely session cookie.",
        urgency: "critical",
    },
    {
        id: "tiktok-rate-limited",
        codes: ["TIKTOK_RATE_LIMITED"],
        title: "TikTok rate limited",
        summary: "TikTok appears to be throttling live-status checks.",
        nextStep: "Wait for the provider cooldown and avoid repeated manual checks until polling recovers.",
        urgency: "warning",
    },
    {
        id: "tiktok-user-not-found",
        codes: ["TIKTOK_USER_NOT_FOUND"],
        title: "TikTok user not found",
        summary: "The configured TikTok username does not resolve.",
        nextStep: "Verify the creator handle and update or pause stale TikTok configs.",
        urgency: "warning",
    },
    {
        id: "bluesky-feed-unavailable",
        codes: ["BLUESKY_FEED_UNAVAILABLE"],
        title: "Bluesky feed unavailable",
        summary: "The configured Bluesky handle could not be loaded.",
        nextStep: "Verify the handle, then check Bluesky availability before changing the config.",
    },
    {
        id: "patch-update-failed",
        codes: ["PATCH_SUBSCRIPTION_UPDATE_FAILED"],
        title: "Patch subscription update failed",
        summary: "A patch note was announced, but saving the updated subscription state failed.",
        nextStep: "Check API/database write health and retry the patch note job after the store is stable.",
        urgency: "critical",
    },
    {
        id: "discord-send-failed",
        codes: ["DISCORD_SEND_FAILED"],
        title: "Discord delivery failed",
        summary: "Discord did not return a message for the notification send.",
        nextStep: "Check the destination channel exists and the bot can view and send messages there.",
    },
    {
        id: "steam-news-poll-failed",
        codes: ["STEAM_NEWS_POLL_FAILED"],
        title: "Steam news poll failed",
        summary: "The Steam news poll failed for the configured app.",
        nextStep: "Verify the Steam app ID and check whether the public news feed is reachable.",
    },
];

const fallbackRules: PlaybookRule[] = [
    {
        id: "auth",
        messagePatterns: [/auth/i, /token/i, /unauthori[sz]ed/i, /forbidden/i, /\b401\b/, /\b403\b/],
        title: "Authentication failure",
        summary: "The provider rejected credentials or an access token.",
        nextStep: "Verify provider credentials and rotate the relevant token or secret if needed.",
        urgency: "critical",
    },
    {
        id: "rate-limit",
        messagePatterns: [/rate.?limit/i, /too many requests/i, /\b429\b/, /quota/i],
        title: "Provider rate limit",
        summary: "The provider appears to be throttling requests.",
        nextStep: "Wait for the cooldown window, then reduce polling pressure if the same provider keeps failing.",
    },
    {
        id: "not-found",
        messagePatterns: [/not found/i, /\b404\b/, /unknown user/i, /unknown channel/i],
        title: "Configured target not found",
        summary: "The provider could not find the configured account, feed, or channel.",
        nextStep: "Verify the configured identifier and pause or update stale configs.",
    },
    {
        id: "network",
        messagePatterns: [/timeout/i, /timed out/i, /network/i, /fetch/i, /unavailable/i, /\b5\d\d\b/],
        title: "Provider fetch failure",
        summary: "The provider request failed or returned unusable data.",
        nextStep: "Retry after a short interval and check provider status if failures continue.",
    },
    {
        id: "discord",
        messagePatterns: [/discord/i, /missing permissions/i, /channel/i, /message/i],
        title: "Discord destination issue",
        summary: "Delivery may be blocked by channel state or bot permissions.",
        nextStep: "Check the destination channel and bot permissions for view/send access.",
    },
];

export function getAdminProviderPlaybookHint(input: AdminProviderPlaybookInput): AdminProviderPlaybookHint | null {
    const code = normalizeKey(input.lastErrorCode);
    const provider = normalizeKey(input.provider);
    const message = input.lastErrorMessage ?? "";

    const explicitRule = explicitRules.find(rule => ruleMatches(rule, { code, provider, message }));
    if (explicitRule) return toHint(explicitRule, input);

    const fallbackRule = fallbackRules.find(rule => ruleMatches(rule, { code, provider, message }));
    if (fallbackRule) return toHint(fallbackRule, input);

    if (input.status === "unknown") {
        return {
            id: "unknown-status",
            title: "Unknown health state",
            summary: "The worker has not reported enough recent data for this integration.",
            nextStep: "Check the worker heartbeat and wait for the next provider poll before changing config.",
            urgency: "info",
        };
    }

    return null;
}

export function formatAdminProviderPlaybookSummary(hint: AdminProviderPlaybookHint | null): string | null {
    return hint ? `Next: ${hint.nextStep}` : null;
}

function ruleMatches(rule: PlaybookRule, input: { code: string; provider: string; message: string }): boolean {
    if (rule.codes?.some(code => normalizeKey(code) === input.code)) return true;
    if (rule.providers?.some(provider => normalizeKey(provider) === input.provider)) return true;
    if (rule.messagePatterns?.some(pattern => pattern.test(input.message) || pattern.test(input.code))) return true;
    return false;
}

function toHint(rule: PlaybookRule, input: AdminProviderPlaybookInput): AdminProviderPlaybookHint {
    const consecutiveFailures = Math.max(0, Number(input.consecutiveFailures ?? 0));
    const urgency = rule.urgency ?? (consecutiveFailures >= 3 ? "critical" : "warning");
    return {
        id: rule.id,
        title: rule.title,
        summary: rule.summary,
        nextStep: rule.nextStep,
        urgency,
    };
}

function normalizeKey(value: string | null | undefined): string {
    return (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}
