import {
    defaultDashboardLocale,
    getDashboardLocaleValue,
    type DashboardLocale,
    type DashboardLocaleValues,
} from "@/lib/i18n/localeStore";

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

type PlaybookLocalizedCopy = Pick<AdminProviderPlaybookHint, "title" | "summary" | "nextStep">;

const playbookCopy: DashboardLocaleValues<Readonly<Record<string, PlaybookLocalizedCopy>>> = {
    en: {},
    nl: {
        "twitch-auth": {
        title: "Twitch-authenticatie mislukt",
        summary: "De worker kon geen Twitch-app-token ophalen.",
        nextStep: "Controleer de Twitch-client-ID en het geheim en bevestig dat de Twitch-app nog actief is.",
    },
    "twitch-user-not-found": {
        title: "Twitch-gebruiker niet gevonden",
        summary: "De ingestelde Twitch-login kan niet meer via Helix worden gevonden.",
        nextStep: "Controleer de gebruikersnaam en werk de configuratie bij of pauzeer deze als het account is hernoemd of verwijderd.",
    },
    "youtube-feed-unavailable": {
        title: "YouTube-feed niet beschikbaar",
        summary: "De RSS-feed voor het ingestelde kanaal bevatte geen bruikbare items.",
        nextStep: "Controleer de YouTube-kanaal-ID en of de kanaalfeed openbaar en bereikbaar is.",
    },
    "tiktok-resolve-failed": {
        title: "TikTok-opzoekactie mislukt",
        summary: "De worker kon de livestreamstatus van de maker niet bepalen.",
        nextStep: "Open de TikTok-diagnostiek, controleer de gebruikersnaam en bekijk de opgeschoonde sessiestatus.",
    },
    "tiktok-auth-required": {
        title: "TikTok-sessie waarschijnlijk vereist",
        summary: "TikTok lijkt voor deze opzoekactie nieuw sessiemateriaal te vereisen.",
        nextStep: "Vernieuw de beheerde TikTok-sessiecookie en controleer of de diagnostiek een waarschijnlijke sessiecookie toont.",
    },
    "tiktok-rate-limited": {
        title: "TikTok-snelheidslimiet bereikt",
        summary: "TikTok lijkt controles van de livestreamstatus te beperken.",
        nextStep: "Wacht op de afkoelperiode en vermijd herhaalde handmatige controles totdat het pollen is hersteld.",
    },
    "tiktok-user-not-found": {
        title: "TikTok-gebruiker niet gevonden",
        summary: "De ingestelde TikTok-gebruikersnaam kan niet worden gevonden.",
        nextStep: "Controleer de gebruikersnaam en werk verouderde TikTok-configuraties bij of pauzeer ze.",
    },
    "bluesky-feed-unavailable": {
        title: "Bluesky-feed niet beschikbaar",
        summary: "De ingestelde Bluesky-handle kon niet worden geladen.",
        nextStep: "Controleer de handle en daarna de beschikbaarheid van Bluesky voordat je de configuratie wijzigt.",
    },
    "patch-update-failed": {
        title: "Bijwerken van patchabonnement mislukt",
        summary: "Er is een patchnotitie aangekondigd, maar de bijgewerkte abonnementsstatus kon niet worden opgeslagen.",
        nextStep: "Controleer de API en database en voer de patchnotitietaak opnieuw uit zodra de opslag stabiel is.",
    },
    "discord-send-failed": {
        title: "Bezorging via Discord mislukt",
        summary: "Discord heeft geen bericht teruggegeven voor de melding.",
        nextStep: "Controleer of het doelkanaal bestaat en of de bot het kanaal kan bekijken en er berichten kan sturen.",
    },
    "steam-news-poll-failed": {
        title: "Ophalen van Steam-nieuws mislukt",
        summary: "De Steam-nieuwscontrole is mislukt voor de ingestelde app.",
        nextStep: "Controleer de Steam-app-ID en of de openbare nieuwsfeed bereikbaar is.",
    },
    auth: {
        title: "Authenticatiefout",
        summary: "De provider heeft de inloggegevens of het toegangstoken geweigerd.",
        nextStep: "Controleer de providergegevens en vervang zo nodig het relevante token of geheim.",
    },
    "rate-limit": {
        title: "Snelheidslimiet van provider",
        summary: "De provider lijkt aanvragen te beperken.",
        nextStep: "Wacht op de afkoelperiode en verlaag de controlefrequentie als dezelfde provider blijft mislukken.",
    },
    "not-found": {
        title: "Ingesteld doel niet gevonden",
        summary: "De provider kon het ingestelde account, de feed of het kanaal niet vinden.",
        nextStep: "Controleer de ingestelde identificatie en pauzeer of wijzig verouderde configuraties.",
    },
    network: {
        title: "Ophalen bij provider mislukt",
        summary: "De provideraanvraag is mislukt of bevatte onbruikbare gegevens.",
        nextStep: "Probeer het na korte tijd opnieuw en controleer de providerstatus als de fouten aanhouden.",
    },
    discord: {
        title: "Probleem met Discord-bestemming",
        summary: "Bezorging wordt mogelijk geblokkeerd door de kanaalstatus of botmachtigingen.",
        nextStep: "Controleer het doelkanaal en de machtigingen van de bot om het te bekijken en berichten te sturen.",
    },
    "unknown-status": {
        title: "Onbekende integratiestatus",
        summary: "De worker heeft nog onvoldoende recente gegevens over deze integratie gemeld.",
        nextStep: "Controleer de heartbeat van de worker en wacht op de volgende providercontrole voordat je de configuratie wijzigt.",
        },
    },
};

const playbookSummaryPrefixes = {
    en: "Next",
    nl: "Volgende stap",
} satisfies DashboardLocaleValues<string>;

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

export function getAdminProviderPlaybookHint(
    input: AdminProviderPlaybookInput,
    locale: DashboardLocale = "en",
): AdminProviderPlaybookHint | null {
    const code = normalizeKey(input.lastErrorCode);
    const provider = normalizeKey(input.provider);
    const message = input.lastErrorMessage ?? "";

    const explicitRule = explicitRules.find(rule => ruleMatches(rule, { code, provider, message }));
    if (explicitRule) return localizeHint(toHint(explicitRule, input), locale);

    const fallbackRule = fallbackRules.find(rule => ruleMatches(rule, { code, provider, message }));
    if (fallbackRule) return localizeHint(toHint(fallbackRule, input), locale);

    if (input.status === "unknown") {
        return localizeHint({
            id: "unknown-status",
            title: "Unknown health state",
            summary: "The worker has not reported enough recent data for this integration.",
            nextStep: "Check the worker heartbeat and wait for the next provider poll before changing config.",
            urgency: "info",
        }, locale);
    }

    return null;
}

function localizeHint(hint: AdminProviderPlaybookHint, locale: DashboardLocale): AdminProviderPlaybookHint {
    const localizedCopies = getDashboardLocaleValue(locale, playbookCopy);
    const fallbackCopies = getDashboardLocaleValue(defaultDashboardLocale, playbookCopy);
    const copy = localizedCopies[hint.id] ?? fallbackCopies[hint.id];
    return copy ? { ...hint, ...copy } : hint;
}

export function formatAdminProviderPlaybookSummary(
    hint: AdminProviderPlaybookHint | null,
    locale: DashboardLocale = "en",
): string | null {
    const prefix = getDashboardLocaleValue(locale, playbookSummaryPrefixes);
    return hint ? `${prefix}: ${hint.nextStep}` : null;
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
