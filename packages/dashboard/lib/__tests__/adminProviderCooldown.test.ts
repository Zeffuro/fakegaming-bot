import { describe, expect, it } from "vitest";
import {
    formatAdminProviderCooldownSummary,
    getAdminProviderCooldownHint,
} from "@/lib/adminProviderCooldown";
import type { IntegrationHealthRecord } from "@/lib/api-client";

function healthRecord(partial: Partial<IntegrationHealthRecord>): IntegrationHealthRecord {
    return {
        id: 1,
        provider: "twitch",
        configId: "config-1",
        guildId: "guild-1",
        channelId: "channel-1",
        status: "healthy",
        lastCheckedAt: "2026-06-23T10:00:00.000Z",
        lastSuccessAt: "2026-06-23T10:00:00.000Z",
        lastFailureAt: null,
        lastDeliveryAt: null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: null,
        createdAt: "2026-06-23T09:00:00.000Z",
        updatedAt: "2026-06-23T10:00:00.000Z",
        ...partial,
    };
}

describe("adminProviderCooldown", () => {
    it("formats paused integration state", () => {
        const hint = getAdminProviderCooldownHint(healthRecord({
            status: "paused",
            metadata: { paused: true },
        }));

        expect(hint).toMatchObject({
            id: "paused",
            state: "paused",
            title: "Integration paused",
        });
        expect(formatAdminProviderCooldownSummary(hint)).toBe("State: paused by config");
    });

    it("detects active notification cooldown windows", () => {
        const hint = getAdminProviderCooldownHint(healthRecord({
            metadata: {
                cooldownMinutes: 15,
                lastNotifiedAt: "2026-06-23T10:00:00.000Z",
                cooldownUntil: "2026-06-23T10:15:00.000Z",
                cooldownActive: true,
            },
        }), Date.parse("2026-06-23T10:05:00.000Z"));

        expect(hint).toMatchObject({
            id: "notification-cooldown-active",
            state: "active",
            until: "2026-06-23T10:15:00.000Z",
        });
        expect(formatAdminProviderCooldownSummary(hint)).toBe("Cooldown: active until 2026-06-23T10:15:00.000Z");
    });

    it("falls back to suppressed cooldown metadata when no until is known", () => {
        const hint = getAdminProviderCooldownHint(healthRecord({
            metadata: { suppressedByCooldown: true },
        }));

        expect(hint).toMatchObject({
            id: "notification-cooldown-suppressed",
            state: "suppressed",
        });
        expect(formatAdminProviderCooldownSummary(hint)).toBe("Cooldown: last delivery suppressed");
    });

    it("shows configured cooldowns that are not active", () => {
        const hint = getAdminProviderCooldownHint(healthRecord({
            metadata: {
                cooldownMinutes: 30,
                lastNotifiedAt: "2026-06-23T09:00:00.000Z",
                cooldownUntil: "2026-06-23T09:30:00.000Z",
                cooldownActive: false,
            },
        }), Date.parse("2026-06-23T10:05:00.000Z"));

        expect(hint).toMatchObject({
            id: "notification-cooldown-configured",
            state: "configured",
        });
        expect(formatAdminProviderCooldownSummary(hint)).toBe("Cooldown: configured");
    });

    it("supports explicit retry timestamps", () => {
        const hint = getAdminProviderCooldownHint(healthRecord({
            metadata: { nextRetryAt: "2026-06-23T10:20:00.000Z" },
        }), Date.parse("2026-06-23T10:05:00.000Z"));

        expect(hint).toMatchObject({
            id: "retry-scheduled",
            state: "retry",
            until: "2026-06-23T10:20:00.000Z",
        });
        expect(formatAdminProviderCooldownSummary(hint)).toBe("Retry: scheduled for 2026-06-23T10:20:00.000Z");
    });
});
