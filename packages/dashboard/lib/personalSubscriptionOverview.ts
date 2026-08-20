import type {
    AnimeSubscriptionDashboardConfig,
    UserDigestSubscription,
    UserReminder,
    UserSettings,
} from "@/lib/api-client";
import type { DashboardTranslator } from "@/lib/i18n/messages";

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
    formatNumber: (value: number) => string;
    t: DashboardTranslator;
}

export function buildPersonalSubscriptionOverview(input: PersonalSubscriptionOverviewInput): PersonalSubscriptionOverview {
    const nowMs = input.nowMs ?? Date.now();
    const reminderItem = buildReminderItem(input.reminders, nowMs, input.formatDateTime, input.formatNumber, input.t);
    const animeItem = buildAnimeItem(input.animeSubscriptions, input.formatDateTime, input.formatNumber, input.t);
    const digestItem = buildDigestItem(input.digestSubscription, input.formatDateTime, input.t);
    const preferencesItem = buildPreferencesItem(input.settings, input.t);
    const activeCount = [reminderItem, animeItem, digestItem]
        .filter((item) => item.status === "active")
        .length;
    const pausedCount = [reminderItem, animeItem, digestItem]
        .filter((item) => item.status === "paused")
        .length;

    return {
        summary: input.t("personal.overviewSummary", {
            active: input.formatNumber(activeCount),
            paused: input.formatNumber(pausedCount),
        }),
        items: [reminderItem, animeItem, digestItem, preferencesItem],
    };
}

function buildReminderItem(
    reminders: UserReminder[],
    nowMs: number,
    formatDateTime: (value: number) => string,
    formatNumber: (value: number) => string,
    t: DashboardTranslator,
): PersonalSubscriptionOverviewItem {
    const recurring = reminders.filter(isRecurringReminder);
    const pausedRecurring = recurring.filter((reminder) => reminder.completed);
    const activeReminders = reminders.filter((reminder) => !reminder.completed);
    const nextReminder = activeReminders
        .filter((reminder) => Number.isFinite(reminder.timestamp))
        .sort((left, right) => left.timestamp - right.timestamp)[0] ?? null;

    return {
        id: "reminders",
        title: t("personal.overviewRemindersTitle"),
        detail: t("personal.overviewRemindersDetail", {
            active: formatNumber(activeReminders.length),
            paused: formatNumber(pausedRecurring.length),
            recurring: formatNumber(recurring.length),
        }),
        meta: nextReminder
            ? nextReminder.timestamp <= nowMs ? t("personal.overviewNextDue") : t("personal.overviewNext", { date: formatDateTime(nextReminder.timestamp) })
            : reminders.length > 0 ? t("personal.overviewAllRemindersPaused") : t("personal.overviewNoReminders"),
        status: activeReminders.length > 0 ? "active" : pausedRecurring.length > 0 ? "paused" : "off",
        statusLabel: activeReminders.length > 0 ? t("personal.statusActive") : pausedRecurring.length > 0 ? t("personal.statusPaused") : t("common.none"),
    };
}

function buildAnimeItem(
    subscriptions: AnimeSubscriptionDashboardConfig[],
    formatDateTime: (value: number) => string,
    formatNumber: (value: number) => string,
    t: DashboardTranslator,
): PersonalSubscriptionOverviewItem {
    const activeSubscriptions = subscriptions.filter((subscription) => !subscription.paused);
    const pausedSubscriptions = subscriptions.length - activeSubscriptions.length;
    const nextAiringAt = activeSubscriptions
        .map((subscription) => subscription.nextAiringAt ?? null)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right)[0] ?? null;

    return {
        id: "anime",
        title: t("personal.overviewAnimeTitle"),
        detail: t("personal.overviewActivePaused", {
            active: formatNumber(activeSubscriptions.length),
            paused: formatNumber(pausedSubscriptions),
        }),
        meta: nextAiringAt
            ? t("personal.overviewNextEpisode", { date: formatDateTime(nextAiringAt * 1000) })
            : subscriptions.length > 0 ? t("personal.overviewNoUpcomingEpisode") : t("personal.overviewNoAnime"),
        status: activeSubscriptions.length > 0 ? "active" : pausedSubscriptions > 0 ? "paused" : "off",
        statusLabel: activeSubscriptions.length > 0 ? t("personal.statusActive") : pausedSubscriptions > 0 ? t("personal.statusPaused") : t("common.none"),
    };
}

function buildDigestItem(
    subscription: UserDigestSubscription | null,
    formatDateTime: (value: number) => string,
    t: DashboardTranslator,
): PersonalSubscriptionOverviewItem {
    if (!subscription) {
        return {
            id: "digest",
            title: t("personal.overviewDigestTitle"),
            detail: t("personal.statusNotConfigured"),
            meta: t("personal.overviewNoDigest"),
            status: "off",
            statusLabel: t("personal.statusOff"),
        };
    }

    const categories = subscription.categories.length > 0
        ? subscription.categories.map(category => formatDigestCategory(category, t)).join(", ")
        : t("personal.overviewNoCategories");
    const cadence = subscription.frequency === "weekly"
        ? t("personal.overviewWeeklyAt", { time: subscription.runAt })
        : t("personal.overviewDailyAt", { time: subscription.runAt });

    return {
        id: "digest",
        title: t("personal.overviewDigestTitle"),
        detail: t("personal.overviewDigestDetail", { cadence, timezone: subscription.timezone }),
        meta: t("personal.overviewDigestMeta", { categories, date: formatDateTime(subscription.nextRunAt) }),
        status: subscription.paused ? "paused" : "active",
        statusLabel: subscription.paused ? t("personal.statusPaused") : t("personal.statusActive"),
    };
}

function buildPreferencesItem(settings: UserSettings | null, t: DashboardTranslator): PersonalSubscriptionOverviewItem {
    const timezoneValue = settings?.timezone?.trim();
    const defaultReminderValue = settings?.defaultReminderTimeSpan?.trim();
    const timezone = timezoneValue || t("personal.notSet");
    const defaultReminder = defaultReminderValue || t("personal.notSet");
    const configured = Boolean(timezoneValue || defaultReminderValue);

    return {
        id: "preferences",
        title: t("personal.overviewPreferencesTitle"),
        detail: t("personal.overviewPreferencesDetail", { timezone, reminders: defaultReminder }),
        meta: configured ? t("personal.overviewPreferencesConfigured") : t("personal.overviewPreferencesMissing"),
        status: configured ? "active" : "attention",
        statusLabel: configured ? t("personal.statusConfigured") : t("personal.statusNeedsSetup"),
    };
}

function isRecurringReminder(reminder: UserReminder): boolean {
    return Boolean(reminder.recurrenceUnit && reminder.recurrenceInterval && reminder.recurrenceTimezone);
}

function formatDigestCategory(category: string, t: DashboardTranslator): string {
    if (category === "anime") return t("personal.categoryAnime");
    if (category === "reminders") return t("personal.categoryReminders");
    return category;
}
