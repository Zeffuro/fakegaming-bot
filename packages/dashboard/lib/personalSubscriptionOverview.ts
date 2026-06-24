import type {
    AnimeSubscriptionDashboardConfig,
    UserDigestSubscription,
    UserReminder,
    UserSettings,
} from "@/lib/api-client";

export type PersonalSubscriptionStatus = "active" | "paused" | "off" | "attention";

export interface PersonalSubscriptionOverviewItem {
    id: "reminders" | "anime" | "digest" | "preferences";
    title: string;
    detail: string;
    meta: string;
    status: PersonalSubscriptionStatus;
    statusLabel: string;
}

export interface PersonalSubscriptionOverview {
    summary: string;
    items: PersonalSubscriptionOverviewItem[];
}

export interface PersonalSubscriptionOverviewInput {
    reminders: UserReminder[];
    animeSubscriptions: AnimeSubscriptionDashboardConfig[];
    digestSubscription: UserDigestSubscription | null;
    settings: UserSettings | null;
    nowMs?: number;
    formatDateTime: (value: number) => string;
}

export function buildPersonalSubscriptionOverview(input: PersonalSubscriptionOverviewInput): PersonalSubscriptionOverview {
    const nowMs = input.nowMs ?? Date.now();
    const reminderItem = buildReminderItem(input.reminders, nowMs, input.formatDateTime);
    const animeItem = buildAnimeItem(input.animeSubscriptions, input.formatDateTime);
    const digestItem = buildDigestItem(input.digestSubscription, input.formatDateTime);
    const preferencesItem = buildPreferencesItem(input.settings);
    const activeCount = [reminderItem, animeItem, digestItem]
        .filter((item) => item.status === "active")
        .length;
    const pausedCount = [reminderItem, animeItem, digestItem]
        .filter((item) => item.status === "paused")
        .length;

    return {
        summary: `${activeCount} active, ${pausedCount} paused`,
        items: [reminderItem, animeItem, digestItem, preferencesItem],
    };
}

function buildReminderItem(
    reminders: UserReminder[],
    nowMs: number,
    formatDateTime: (value: number) => string,
): PersonalSubscriptionOverviewItem {
    const recurring = reminders.filter(isRecurringReminder);
    const pausedRecurring = recurring.filter((reminder) => reminder.completed);
    const activeReminders = reminders.filter((reminder) => !reminder.completed);
    const nextReminder = activeReminders
        .filter((reminder) => Number.isFinite(reminder.timestamp))
        .sort((left, right) => left.timestamp - right.timestamp)[0] ?? null;

    return {
        id: "reminders",
        title: "Personal reminders",
        detail: `${activeReminders.length} active, ${pausedRecurring.length} paused, ${recurring.length} recurring`,
        meta: nextReminder
            ? nextReminder.timestamp <= nowMs ? "Next reminder is due now" : `Next ${formatDateTime(nextReminder.timestamp)}`
            : reminders.length > 0 ? "All current recurring reminders are paused" : "No reminder subscriptions configured",
        status: activeReminders.length > 0 ? "active" : pausedRecurring.length > 0 ? "paused" : "off",
        statusLabel: activeReminders.length > 0 ? "Active" : pausedRecurring.length > 0 ? "Paused" : "None",
    };
}

function buildAnimeItem(
    subscriptions: AnimeSubscriptionDashboardConfig[],
    formatDateTime: (value: number) => string,
): PersonalSubscriptionOverviewItem {
    const activeSubscriptions = subscriptions.filter((subscription) => !subscription.paused);
    const pausedSubscriptions = subscriptions.length - activeSubscriptions.length;
    const nextAiringAt = activeSubscriptions
        .map((subscription) => subscription.nextAiringAt ?? null)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right)[0] ?? null;

    return {
        id: "anime",
        title: "Anime DM reminders",
        detail: `${activeSubscriptions.length} active, ${pausedSubscriptions} paused`,
        meta: nextAiringAt
            ? `Next episode ${formatDateTime(nextAiringAt * 1000)}`
            : subscriptions.length > 0 ? "No upcoming episode timestamp available" : "No anime DM subscriptions configured",
        status: activeSubscriptions.length > 0 ? "active" : pausedSubscriptions > 0 ? "paused" : "off",
        statusLabel: activeSubscriptions.length > 0 ? "Active" : pausedSubscriptions > 0 ? "Paused" : "None",
    };
}

function buildDigestItem(
    subscription: UserDigestSubscription | null,
    formatDateTime: (value: number) => string,
): PersonalSubscriptionOverviewItem {
    if (!subscription) {
        return {
            id: "digest",
            title: "Personal digest",
            detail: "Not configured",
            meta: "No daily or weekly DM summary is scheduled",
            status: "off",
            statusLabel: "Off",
        };
    }

    const categories = subscription.categories.length > 0
        ? subscription.categories.map(formatDigestCategory).join(", ")
        : "No categories";
    const cadence = subscription.frequency === "weekly"
        ? `Weekly at ${subscription.runAt}`
        : `Daily at ${subscription.runAt}`;

    return {
        id: "digest",
        title: "Personal digest",
        detail: `${cadence} (${subscription.timezone})`,
        meta: `${categories}; next ${formatDateTime(subscription.nextRunAt)}`,
        status: subscription.paused ? "paused" : "active",
        statusLabel: subscription.paused ? "Paused" : "Active",
    };
}

function buildPreferencesItem(settings: UserSettings | null): PersonalSubscriptionOverviewItem {
    const timezone = settings?.timezone?.trim() || "not set";
    const defaultReminder = settings?.defaultReminderTimeSpan?.trim() || "not set";
    const configured = timezone !== "not set" || defaultReminder !== "not set";

    return {
        id: "preferences",
        title: "Notification preferences",
        detail: `Timezone ${timezone}; reminders ${defaultReminder}`,
        meta: configured ? "Used by recurring reminders and digest scheduling" : "Add a timezone before relying on recurring schedules",
        status: configured ? "active" : "attention",
        statusLabel: configured ? "Configured" : "Needs setup",
    };
}

function isRecurringReminder(reminder: UserReminder): boolean {
    return Boolean(reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone);
}

function formatDigestCategory(category: string): string {
    if (category === "anime") return "Anime";
    if (category === "reminders") return "Reminders";
    return category;
}
