import type { UserActivityAuditEvent, UserActivityDeliveryRecord } from "@/lib/api-client";
import type { DashboardMessageKey, DashboardTranslator } from "@/lib/i18n/messages";

export type UserActivityFeedItemType = "audit" | "delivery";

export interface UserActivityFeedItem {
    id: string;
    type: UserActivityFeedItemType;
    title: string;
    detail: string;
    timestamp: string | null;
    status?: UserActivityAuditEvent["status"];
}

export interface BuildUserActivityFeedInput {
    auditEvents: UserActivityAuditEvent[];
    deliveries: UserActivityDeliveryRecord[];
    limit?: number;
    t: DashboardTranslator;
}

const auditActionLabels: Record<string, DashboardMessageKey> = {
    "animeSubscription.create": "personal.activityAnimeCreate",
    "animeSubscription.delete": "personal.activityAnimeDelete",
    "animeSubscription.pause": "personal.activityAnimePause",
    "animeSubscription.resume": "personal.activityAnimeResume",
    "birthday.create": "personal.activityBirthdayCreate",
    "birthday.delete": "personal.activityBirthdayDelete",
    "birthday.update": "personal.activityBirthdayUpdate",
    "quote.create": "personal.activityQuoteCreate",
    "reminder.create": "personal.activityReminderCreate",
    "reminder.delete": "personal.activityReminderDelete",
    "riot.leagueForm": "personal.activityLeagueForm",
    "riotLink.delete": "personal.activityRiotDelete",
    "riotLink.upsert": "personal.activityRiotUpsert",
    "userDigestSubscription.pause": "personal.activityDigestPause",
    "userDigestSubscription.resume": "personal.activityDigestResume",
    "userDigestSubscription.upsert": "personal.activityDigestUpsert",
    "userReminder.create": "personal.activityReminderCreate",
    "userReminder.delete": "personal.activityReminderDelete",
    "userReminder.pause": "personal.activityReminderPause",
    "userReminder.resume": "personal.activityReminderResume",
    "userReminder.snooze": "personal.activityReminderSnooze",
};

export function buildUserActivityFeed(input: BuildUserActivityFeedInput): UserActivityFeedItem[] {
    const limit = Number.isInteger(input.limit) && input.limit !== undefined ? Math.max(0, input.limit) : 8;
    const items = [
        ...input.auditEvents.map(event => formatAuditEvent(event, input.t)),
        ...input.deliveries.map(record => formatDeliveryRecord(record, input.t)),
    ];

    return items
        .sort((left, right) => getTimestampMs(right.timestamp) - getTimestampMs(left.timestamp))
        .slice(0, limit);
}

function formatAuditEvent(event: UserActivityAuditEvent, t: DashboardTranslator): UserActivityFeedItem {
    const labelKey = auditActionLabels[event.action];
    return {
        id: `audit:${event.id}`,
        type: "audit",
        title: labelKey ? t(labelKey) : t("personal.activityUnknownAction", { action: event.action }),
        detail: formatAuditDetail(event, t),
        timestamp: event.timestamp,
        status: event.status,
    };
}

function formatDeliveryRecord(record: UserActivityDeliveryRecord, t: DashboardTranslator): UserActivityFeedItem {
    return {
        id: `delivery:${record.id}`,
        type: "delivery",
        title: t("personal.activityBirthdayDelivery"),
        detail: [
            record.guildId ? t("personal.activityGuild", { guildId: record.guildId }) : t("personal.activityUnknownGuild"),
            record.channelId ? t("personal.activityChannel", { channelId: record.channelId }) : null,
        ].filter(Boolean).join(" - "),
        timestamp: record.createdAt ?? record.updatedAt ?? null,
    };
}

function formatAuditDetail(event: UserActivityAuditEvent, t: DashboardTranslator): string {
    const target = event.targetId ? `${event.targetType} ${event.targetId}` : event.targetType;
    const parts = [
        target,
        event.guildId ? t("personal.activityGuild", { guildId: event.guildId }) : null,
        event.status === "failure" ? t("personal.activityFailed") : null,
    ];
    return parts.filter(Boolean).join(" - ");
}

function getTimestampMs(value: string | null): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
