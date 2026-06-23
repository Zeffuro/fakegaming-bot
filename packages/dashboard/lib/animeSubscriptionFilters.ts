import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

export type AnimeSubscriptionScope = "server" | "personal";
export type AnimeSubscriptionStatusFilter = "all" | "active" | "paused" | "airing-known" | "airing-missing";

export interface AnimeSubscriptionFilterInput {
    query?: string;
    status?: AnimeSubscriptionStatusFilter;
    channelNames?: Record<string, string | undefined>;
}

export interface FilterableAnimeSubscription {
    scope: AnimeSubscriptionScope;
    config: AnimeSubscriptionDashboardConfig;
}

function normalizeSearchValue(value: string): string {
    return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function getChannelId(config: AnimeSubscriptionDashboardConfig): string {
    return config.channelId ?? config.discordChannelId ?? "";
}

function matchesStatus(config: AnimeSubscriptionDashboardConfig, status: AnimeSubscriptionStatusFilter): boolean {
    if (status === "all") return true;
    if (status === "active") return !config.paused;
    if (status === "paused") return Boolean(config.paused);
    if (status === "airing-known") return Boolean(config.nextAiringAt);
    return !config.nextAiringAt;
}

function matchesQuery(item: FilterableAnimeSubscription, query: string, channelNames: Record<string, string | undefined>): boolean {
    if (!query) return true;

    const channelId = getChannelId(item.config);
    const values = [
        item.scope,
        item.config.id?.toString(),
        item.config.anilistId.toString(),
        item.config.animeTitle,
        item.config.status,
        item.config.format,
        item.config.nextEpisode ? `episode ${item.config.nextEpisode}` : null,
        item.config.paused ? "paused" : "active",
        channelId,
        channelNames[channelId],
    ];

    return values.some((value) => typeof value === "string" && normalizeSearchValue(value).includes(query));
}

export function filterAnimeSubscriptions(
    subscriptions: FilterableAnimeSubscription[],
    input: AnimeSubscriptionFilterInput = {},
): FilterableAnimeSubscription[] {
    const query = normalizeSearchValue(input.query ?? "");
    const status = input.status ?? "all";
    const channelNames = input.channelNames ?? {};

    return subscriptions.filter((item) => (
        matchesStatus(item.config, status)
        && matchesQuery(item, query, channelNames)
    ));
}

export function combineAnimeSubscriptions(
    serverSubscriptions: AnimeSubscriptionDashboardConfig[],
    personalSubscriptions: AnimeSubscriptionDashboardConfig[],
): FilterableAnimeSubscription[] {
    return [
        ...serverSubscriptions.map((config) => ({ scope: "server" as const, config })),
        ...personalSubscriptions.map((config) => ({ scope: "personal" as const, config })),
    ];
}
