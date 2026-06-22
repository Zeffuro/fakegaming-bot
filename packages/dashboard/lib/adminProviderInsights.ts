import type { IntegrationHealthRecord, NotificationProviderSummary } from "@/lib/api-client";

export type AdminProviderInsightState = "needs-review" | "active";

export interface AdminProviderInsight {
    provider: string;
    providerKey: string;
    healthErrors: number;
    consecutiveFailures: number;
    affectedGuilds: number;
    deliveries: number;
    state: AdminProviderInsightState;
    href: string;
}

interface ProviderAccumulator {
    provider: string;
    providerKey: string;
    healthErrors: number;
    consecutiveFailures: number;
    guildIds: Set<string>;
    deliveries: number;
}

const providerLabels = new Map<string, string>([
    ["anime", "Anime"],
    ["birthday", "Birthday"],
    ["bluesky", "Bluesky"],
    ["patchnotes", "Patch Notes"],
    ["steamnews", "Steam News"],
    ["tiktok", "TikTok"],
    ["twitch", "Twitch"],
    ["youtube", "YouTube"],
]);

export function buildAdminProviderInsights(input: {
    healthRecords?: IntegrationHealthRecord[];
    notificationProviders?: NotificationProviderSummary[];
}): AdminProviderInsight[] {
    const providers = new Map<string, ProviderAccumulator>();

    for (const record of input.healthRecords ?? []) {
        if (record.status !== "error") continue;
        const provider = getProviderAccumulator(providers, record.provider);
        if (!provider) continue;

        provider.healthErrors += 1;
        provider.consecutiveFailures += Math.max(0, record.consecutiveFailures);
        if (record.guildId) provider.guildIds.add(record.guildId);
    }

    for (const item of input.notificationProviders ?? []) {
        const provider = getProviderAccumulator(providers, item.provider);
        if (!provider) continue;

        provider.deliveries += Math.max(0, item.count);
    }

    return [...providers.values()]
        .map((provider) => toProviderInsight(provider))
        .filter((provider) => provider.healthErrors > 0 || provider.deliveries > 0)
        .sort(compareProviderInsights);
}

function getProviderAccumulator(
    providers: Map<string, ProviderAccumulator>,
    providerName: string
): ProviderAccumulator | null {
    const providerKey = normalizeProviderKey(providerName);
    if (!providerKey) return null;

    const existing = providers.get(providerKey);
    if (existing) return existing;

    const provider = {
        provider: providerLabels.get(providerKey) ?? providerName.trim(),
        providerKey,
        healthErrors: 0,
        consecutiveFailures: 0,
        guildIds: new Set<string>(),
        deliveries: 0,
    };
    providers.set(providerKey, provider);
    return provider;
}

function toProviderInsight(provider: ProviderAccumulator): AdminProviderInsight {
    const state: AdminProviderInsightState = provider.healthErrors > 0 ? "needs-review" : "active";

    return {
        provider: provider.provider,
        providerKey: provider.providerKey,
        healthErrors: provider.healthErrors,
        consecutiveFailures: provider.consecutiveFailures,
        affectedGuilds: provider.guildIds.size,
        deliveries: provider.deliveries,
        state,
        href: buildProviderInsightHref(provider.providerKey, state),
    };
}

function compareProviderInsights(a: AdminProviderInsight, b: AdminProviderInsight): number {
    if (a.state !== b.state) return a.state === "needs-review" ? -1 : 1;
    return b.healthErrors - a.healthErrors
        || b.consecutiveFailures - a.consecutiveFailures
        || b.deliveries - a.deliveries
        || a.provider.localeCompare(b.provider);
}

function buildProviderInsightHref(providerKey: string, state: AdminProviderInsightState): string {
    const provider = encodeURIComponent(providerKey);
    if (state === "needs-review") {
        return `/dashboard/admin/integration-health?provider=${provider}&status=error`;
    }
    return `/dashboard/admin/notifications?provider=${provider}`;
}

function normalizeProviderKey(providerName: string): string | null {
    const normalized = providerName.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (!normalized) return null;
    if (normalized === "patchnotes" || normalized === "patchnote") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    return normalized;
}
