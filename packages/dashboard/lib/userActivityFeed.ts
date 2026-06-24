import type { UserActivityAuditEvent, UserActivityDeliveryRecord } from "@/lib/api-client";

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
}

const auditActionLabels: Record<string, string> = {
    "animeSubscription.create": "Created anime subscription",
    "animeSubscription.delete": "Removed anime subscription",
    "animeSubscription.pause": "Paused anime subscription",
    "animeSubscription.resume": "Resumed anime subscription",
    "birthday.create": "Created birthday",
    "birthday.delete": "Deleted birthday",
    "birthday.update": "Updated birthday",
    "quote.create": "Added quote",
    "reminder.create": "Created reminder",
    "reminder.delete": "Deleted reminder",
    "riotLink.delete": "Removed Riot link",
    "riotLink.upsert": "Updated Riot link",
    "userDigestSubscription.pause": "Paused personal digest",
    "userDigestSubscription.resume": "Resumed personal digest",
    "userDigestSubscription.upsert": "Updated personal digest",
    "userReminder.create": "Created reminder",
    "userReminder.delete": "Deleted reminder",
    "userReminder.pause": "Paused reminder",
    "userReminder.resume": "Resumed reminder",
    "userReminder.snooze": "Snoozed reminder",
};

export function buildUserActivityFeed(input: BuildUserActivityFeedInput): UserActivityFeedItem[] {
    const limit = Number.isInteger(input.limit) && input.limit !== undefined ? Math.max(0, input.limit) : 8;
    const items = [
        ...input.auditEvents.map(formatAuditEvent),
        ...input.deliveries.map(formatDeliveryRecord),
    ];

    return items
        .sort((left, right) => getTimestampMs(right.timestamp) - getTimestampMs(left.timestamp))
        .slice(0, limit);
}

function formatAuditEvent(event: UserActivityAuditEvent): UserActivityFeedItem {
    return {
        id: `audit:${event.id}`,
        type: "audit",
        title: auditActionLabels[event.action] ?? formatUnknownAction(event.action),
        detail: formatAuditDetail(event),
        timestamp: event.timestamp,
        status: event.status,
    };
}

function formatDeliveryRecord(record: UserActivityDeliveryRecord): UserActivityFeedItem {
    return {
        id: `delivery:${record.id}`,
        type: "delivery",
        title: "Birthday delivery",
        detail: [
            record.guildId ? `Guild ${record.guildId}` : "Unknown guild",
            record.channelId ? `channel ${record.channelId}` : null,
        ].filter(Boolean).join(" - "),
        timestamp: record.createdAt ?? record.updatedAt ?? null,
    };
}

function formatAuditDetail(event: UserActivityAuditEvent): string {
    const target = event.targetId ? `${event.targetType} ${event.targetId}` : event.targetType;
    const parts = [
        target,
        event.guildId ? `guild ${event.guildId}` : null,
        event.status === "failure" ? "failed" : null,
    ];
    return parts.filter(Boolean).join(" - ");
}

function formatUnknownAction(action: string): string {
    const spaced = action
        .replace(/\./g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim();
    if (!spaced) return "Account activity";
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function getTimestampMs(value: string | null): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
