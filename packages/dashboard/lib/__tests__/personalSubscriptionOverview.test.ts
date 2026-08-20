import { describe, expect, it } from "vitest";
import { buildPersonalSubscriptionOverview } from "@/lib/personalSubscriptionOverview";
import type {
    AnimeSubscriptionDashboardConfig,
    UserDigestSubscription,
    UserReminder,
    UserSettings,
} from "@/lib/api-client";
import { formatDashboardMessage, type DashboardTranslator } from "@/lib/i18n/messages";

const nowMs = Date.parse("2026-06-24T12:00:00.000Z");
const english: DashboardTranslator = (key, values) => formatDashboardMessage("en", key, values);
const dutch: DashboardTranslator = (key, values) => formatDashboardMessage("nl", key, values);

function formatDateTime(value: number): string {
    return new Date(value).toISOString();
}

function reminder(overrides: Partial<UserReminder> = {}): UserReminder {
    return {
        id: "reminder-1",
        userId: "user-1",
        message: "Reminder",
        timespan: "1h",
        timestamp: nowMs + 3_600_000,
        completed: false,
        recurrenceUnit: null,
        recurrenceInterval: null,
        recurrenceTimezone: null,
        lastTriggeredAt: null,
        nextPreviewAt: null,
        createdAt: "2026-06-24T10:00:00.000Z",
        updatedAt: "2026-06-24T10:00:00.000Z",
        ...overrides,
    };
}

function animeSubscription(overrides: Partial<AnimeSubscriptionDashboardConfig> = {}): AnimeSubscriptionDashboardConfig {
    return {
        id: 1,
        anilistId: 100,
        animeTitle: "Airing Show",
        discordChannelId: "user-1",
        guildId: "dm",
        targetType: "dm",
        userId: "user-1",
        reminderMinutes: 30,
        nextAiringAt: Math.floor((nowMs + 7_200_000) / 1000),
        paused: false,
        ...overrides,
    };
}

function digestSubscription(overrides: Partial<UserDigestSubscription> = {}): UserDigestSubscription {
    return {
        id: "digest-1",
        discordId: "user-1",
        frequency: "daily",
        timezone: "Europe/Amsterdam",
        runAt: "09:00",
        dayOfWeek: null,
        categories: ["reminders", "anime"],
        paused: false,
        nextRunAt: nowMs + 86_400_000,
        lastRunAt: null,
        lastSentAt: null,
        createdAt: "2026-06-24T10:00:00.000Z",
        updatedAt: "2026-06-24T10:00:00.000Z",
        ...overrides,
    };
}

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
    return {
        discordId: "user-1",
        timezone: "Europe/Amsterdam",
        defaultReminderTimeSpan: "1h",
        preferredLocale: null,
        ...overrides,
    };
}

describe("personalSubscriptionOverview", () => {
    it("builds an empty overview for accounts without subscriptions", () => {
        const overview = buildPersonalSubscriptionOverview({
            reminders: [],
            animeSubscriptions: [],
            digestSubscription: null,
            settings: null,
            nowMs,
            formatDateTime,
            formatNumber: String,
            t: english,
        });

        expect(overview.summary).toBe("0 active, 0 paused");
        expect(overview.items.map(item => [item.id, item.status, item.statusLabel])).toEqual([
            ["reminders", "off", "None"],
            ["anime", "off", "None"],
            ["digest", "off", "Off"],
            ["preferences", "attention", "Needs setup"],
        ]);
    });

    it("summarizes active and paused personal subscriptions", () => {
        const overview = buildPersonalSubscriptionOverview({
            reminders: [
                reminder({ id: "one-off" }),
                reminder({
                    id: "paused-recurring",
                    completed: true,
                    recurrenceUnit: "week",
                    recurrenceInterval: 1,
                    recurrenceTimezone: "Europe/Amsterdam",
                }),
            ],
            animeSubscriptions: [
                animeSubscription({ id: 1, paused: false }),
                animeSubscription({ id: 2, paused: true }),
            ],
            digestSubscription: digestSubscription(),
            settings: settings(),
            nowMs,
            formatDateTime,
            formatNumber: String,
            t: english,
        });

        expect(overview.summary).toBe("3 active, 0 paused");
        expect(overview.items[0]).toMatchObject({
            id: "reminders",
            detail: "1 active, 1 paused, 1 recurring",
            meta: "Next 2026-06-24T13:00:00.000Z",
            status: "active",
        });
        expect(overview.items[1]).toMatchObject({
            id: "anime",
            detail: "1 active, 1 paused",
            meta: "Next episode 2026-06-24T14:00:00.000Z",
            status: "active",
        });
        expect(overview.items[2]).toMatchObject({
            id: "digest",
            detail: "Daily at 09:00 (Europe/Amsterdam)",
            meta: "Reminders, Anime; next 2026-06-25T12:00:00.000Z",
            status: "active",
        });
        expect(overview.items[3]).toMatchObject({
            id: "preferences",
            status: "active",
            statusLabel: "Configured",
        });
    });

    it("reports paused subscriptions when nothing is active", () => {
        const overview = buildPersonalSubscriptionOverview({
            reminders: [
                reminder({
                    completed: true,
                    recurrenceUnit: "day",
                    recurrenceInterval: 1,
                    recurrenceTimezone: "UTC",
                }),
            ],
            animeSubscriptions: [animeSubscription({ paused: true })],
            digestSubscription: digestSubscription({ paused: true, frequency: "weekly", runAt: "20:30", categories: ["anime"] }),
            settings: settings({ timezone: null, defaultReminderTimeSpan: null }),
            nowMs,
            formatDateTime,
            formatNumber: String,
            t: english,
        });

        expect(overview.summary).toBe("0 active, 3 paused");
        expect(overview.items[0]).toMatchObject({
            status: "paused",
            meta: "All current recurring reminders are paused",
        });
        expect(overview.items[1]).toMatchObject({
            status: "paused",
            meta: "No upcoming episode timestamp available",
        });
        expect(overview.items[2]).toMatchObject({
            status: "paused",
            detail: "Weekly at 20:30 (Europe/Amsterdam)",
            meta: "Anime; next 2026-06-25T12:00:00.000Z",
        });
        expect(overview.items[3]).toMatchObject({
            status: "attention",
            meta: "Add a timezone before relying on recurring schedules",
        });
    });

    it("calls out reminders that are already due", () => {
        const overview = buildPersonalSubscriptionOverview({
            reminders: [reminder({ timestamp: nowMs - 1_000 })],
            animeSubscriptions: [],
            digestSubscription: null,
            settings: null,
            nowMs,
            formatDateTime,
            formatNumber: String,
            t: english,
        });

        expect(overview.items[0]).toMatchObject({
            status: "active",
            meta: "Next reminder is due now",
        });
    });

    it("builds Dutch summaries without changing stored schedule values", () => {
        const overview = buildPersonalSubscriptionOverview({
            reminders: [reminder()],
            animeSubscriptions: [animeSubscription()],
            digestSubscription: digestSubscription({ frequency: "weekly", runAt: "09:00" }),
            settings: settings(),
            nowMs,
            formatDateTime,
            formatNumber: String,
            t: dutch,
        });

        expect(overview.summary).toBe("3 actief, 0 gepauzeerd");
        expect(overview.items[0]).toMatchObject({
            title: "Persoonlijke herinneringen",
            detail: "1 actief, 0 gepauzeerd, 0 terugkerend",
        });
        expect(overview.items[2]).toMatchObject({
            detail: "Wekelijks om 09:00 (Europe/Amsterdam)",
            meta: "Herinneringen, Anime; volgende 2026-06-25T12:00:00.000Z",
        });
    });
});
