import { describe, expect, it } from "vitest";
import { buildUserActivityFeed } from "@/lib/userActivityFeed";
import type { UserActivityAuditEvent, UserActivityDeliveryRecord } from "@/lib/api-client";

function auditEvent(partial: Partial<UserActivityAuditEvent>): UserActivityAuditEvent {
    return {
        id: 1,
        timestamp: "2026-06-24T10:00:00.000Z",
        actorId: "user-1",
        actorType: "user",
        action: "userReminder.create",
        targetType: "reminder",
        targetId: "reminder-1",
        guildId: null,
        severity: "info",
        status: "success",
        requestId: null,
        metadata: null,
        ...partial,
    };
}

function deliveryRecord(partial: Partial<UserActivityDeliveryRecord>): UserActivityDeliveryRecord {
    return {
        id: 1,
        provider: "birthday",
        eventId: "guild-1:user-1:2026-06-24",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "message-1",
        createdAt: "2026-06-24T11:00:00.000Z",
        updatedAt: "2026-06-24T11:00:00.000Z",
        ...partial,
    };
}

describe("userActivityFeed", () => {
    it("combines audit events and deliveries by newest timestamp", () => {
        const items = buildUserActivityFeed({
            auditEvents: [
                auditEvent({ id: 1, timestamp: "2026-06-24T09:00:00.000Z", action: "userReminder.create" }),
                auditEvent({ id: 2, timestamp: "2026-06-24T12:00:00.000Z", action: "riotLink.upsert", targetType: "riotLink", targetId: "user-1" }),
            ],
            deliveries: [
                deliveryRecord({ id: 3, createdAt: "2026-06-24T10:00:00.000Z" }),
            ],
        });

        expect(items.map(item => item.id)).toEqual(["audit:2", "delivery:3", "audit:1"]);
        expect(items[0]).toMatchObject({
            title: "Updated Riot link",
            detail: "riotLink user-1",
        });
        expect(items[1]).toMatchObject({
            title: "Birthday delivery",
            detail: "Guild guild-1 - channel channel-1",
        });
    });

    it("labels failures and unknown actions", () => {
        const items = buildUserActivityFeed({
            auditEvents: [
                auditEvent({
                    action: "customThing.runNow",
                    targetType: "custom",
                    targetId: null,
                    guildId: "guild-1",
                    status: "failure",
                }),
            ],
            deliveries: [],
        });

        expect(items).toEqual([
            expect.objectContaining({
                title: "Custom Thing run Now",
                detail: "custom - guild guild-1 - failed",
                status: "failure",
            }),
        ]);
    });

    it("labels League form audit events", () => {
        const items = buildUserActivityFeed({
            auditEvents: [
                auditEvent({
                    action: "riot.leagueForm",
                    targetType: "riotRecentForm",
                    targetId: "EUW",
                    guildId: "guild-1",
                }),
            ],
            deliveries: [],
        });

        expect(items).toEqual([
            expect.objectContaining({
                title: "Checked League form",
                detail: "riotRecentForm EUW - guild guild-1",
            }),
        ]);
    });

    it("honors a bounded limit", () => {
        const items = buildUserActivityFeed({
            auditEvents: [
                auditEvent({ id: 1, timestamp: "2026-06-24T09:00:00.000Z" }),
                auditEvent({ id: 2, timestamp: "2026-06-24T10:00:00.000Z" }),
            ],
            deliveries: [
                deliveryRecord({ id: 3, createdAt: "2026-06-24T11:00:00.000Z" }),
            ],
            limit: 2,
        });

        expect(items.map(item => item.id)).toEqual(["delivery:3", "audit:2"]);
    });
});
