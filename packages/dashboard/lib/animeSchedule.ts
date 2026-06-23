import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

export type AnimeScheduleScope = "server" | "personal";
export type AnimeScheduleStatus = "upcoming" | "due-now" | "aired" | "paused";

export interface AnimeScheduleItem {
    key: string;
    scope: AnimeScheduleScope;
    subscription: AnimeSubscriptionDashboardConfig;
    airingAt: number;
    reminderAt: number;
    status: AnimeScheduleStatus;
}

export interface AnimeScheduleSummary {
    totalSubscriptions: number;
    activeSubscriptions: number;
    pausedSubscriptions: number;
    scheduledSubscriptions: number;
    unscheduledSubscriptions: number;
    dueWithin24Hours: number;
    dueNow: number;
    nextItem: AnimeScheduleItem | null;
}

export interface AnimeScheduleBuildResult {
    items: AnimeScheduleItem[];
    summary: AnimeScheduleSummary;
}

const dayMs = 24 * 60 * 60 * 1000;
const timestampSecondThreshold = 1_000_000_000_000;

function normalizeTimestamp(value?: number | string | null): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric < timestampSecondThreshold ? numeric * 1000 : numeric;
}

function scheduleKey(scope: AnimeScheduleScope, subscription: AnimeSubscriptionDashboardConfig): string {
    return `${scope}:${subscription.id ?? subscription.anilistId}:${subscription.channelId ?? subscription.discordChannelId ?? subscription.userId ?? "unknown"}`;
}

function getScheduleStatus(args: {
    paused: boolean;
    airingAt: number;
    reminderAt: number;
    now: number;
}): AnimeScheduleStatus {
    if (args.paused) return "paused";
    if (args.airingAt <= args.now) return "aired";
    if (args.reminderAt <= args.now) return "due-now";
    return "upcoming";
}

export function buildAnimeAiringSchedule(
    serverSubscriptions: AnimeSubscriptionDashboardConfig[],
    personalSubscriptions: AnimeSubscriptionDashboardConfig[],
    now = Date.now(),
    limit = 8,
): AnimeScheduleBuildResult {
    const subscriptions = [
        ...serverSubscriptions.map((subscription) => ({ scope: "server" as const, subscription })),
        ...personalSubscriptions.map((subscription) => ({ scope: "personal" as const, subscription })),
    ];
    const normalizedNow = normalizeTimestamp(now) ?? Date.now();
    const items: AnimeScheduleItem[] = [];
    let pausedSubscriptions = 0;
    let unscheduledSubscriptions = 0;

    for (const entry of subscriptions) {
        const paused = Boolean(entry.subscription.paused);
        if (paused) pausedSubscriptions += 1;

        const airingAt = normalizeTimestamp(entry.subscription.nextAiringAt);
        if (!airingAt) {
            unscheduledSubscriptions += 1;
            continue;
        }

        const reminderMinutes = Math.max(0, Number(entry.subscription.reminderMinutes ?? 30));
        const reminderAt = airingAt - reminderMinutes * 60 * 1000;
        items.push({
            key: scheduleKey(entry.scope, entry.subscription),
            scope: entry.scope,
            subscription: entry.subscription,
            airingAt,
            reminderAt,
            status: getScheduleStatus({
                paused,
                airingAt,
                reminderAt,
                now: normalizedNow,
            }),
        });
    }

    const sortedItems = [...items].sort((left, right) => (
        left.airingAt - right.airingAt
        || left.reminderAt - right.reminderAt
        || left.key.localeCompare(right.key)
    ));
    const activeScheduledItems = sortedItems.filter((item) => item.status !== "paused" && item.status !== "aired");

    return {
        items: sortedItems.slice(0, Math.max(0, limit)),
        summary: {
            totalSubscriptions: subscriptions.length,
            activeSubscriptions: subscriptions.length - pausedSubscriptions,
            pausedSubscriptions,
            scheduledSubscriptions: items.length,
            unscheduledSubscriptions,
            dueWithin24Hours: activeScheduledItems.filter((item) => item.reminderAt > normalizedNow && item.reminderAt <= normalizedNow + dayMs).length,
            dueNow: activeScheduledItems.filter((item) => item.status === "due-now").length,
            nextItem: activeScheduledItems[0] ?? null,
        },
    };
}
