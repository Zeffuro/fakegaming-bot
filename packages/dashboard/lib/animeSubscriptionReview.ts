import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";
import type { AnimeSubscriptionScope, FilterableAnimeSubscription } from "@/lib/animeSubscriptionFilters";

export interface DuplicateAnimeSubscriptionGroup {
    key: string;
    scope: AnimeSubscriptionScope;
    anilistId: number;
    destinationId: string;
    title: string;
    count: number;
    subscriptions: FilterableAnimeSubscription[];
}

function getSubscriptionDestinationId(item: FilterableAnimeSubscription): string {
    if (item.scope === "personal") return item.config.userId ?? "dm";
    return item.config.channelId ?? item.config.discordChannelId ?? "unknown-channel";
}

function getSubscriptionKey(item: FilterableAnimeSubscription): string {
    return `${item.scope}:${item.config.anilistId}:${getSubscriptionDestinationId(item)}`;
}

function sortSubscriptionRecord(left: AnimeSubscriptionDashboardConfig, right: AnimeSubscriptionDashboardConfig): number {
    return (Number(left.id ?? 0) - Number(right.id ?? 0))
        || left.animeTitle.localeCompare(right.animeTitle)
        || left.anilistId - right.anilistId;
}

export function findDuplicateAnimeSubscriptionGroups(
    subscriptions: FilterableAnimeSubscription[],
    limit = 5,
): DuplicateAnimeSubscriptionGroup[] {
    const groups = new Map<string, FilterableAnimeSubscription[]>();

    for (const item of subscriptions) {
        const key = getSubscriptionKey(item);
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return Array.from(groups.entries())
        .filter(([, items]) => items.length > 1)
        .map(([key, items]) => {
            const sortedItems = [...items].sort((left, right) => sortSubscriptionRecord(left.config, right.config));
            const first = sortedItems[0];
            return {
                key,
                scope: first?.scope ?? "server",
                anilistId: first?.config.anilistId ?? 0,
                destinationId: first ? getSubscriptionDestinationId(first) : "unknown-channel",
                title: first?.config.animeTitle ?? `AniList #${first?.config.anilistId ?? "unknown"}`,
                count: sortedItems.length,
                subscriptions: sortedItems,
            };
        })
        .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title) || left.destinationId.localeCompare(right.destinationId))
        .slice(0, Math.max(0, limit));
}

export function getDuplicateAnimeSubscriptionsToRemove(group: DuplicateAnimeSubscriptionGroup): FilterableAnimeSubscription[] {
    return group.subscriptions.slice(1);
}
