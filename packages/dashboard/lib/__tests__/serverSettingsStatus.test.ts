import { describe, expect, it } from "vitest";
import { buildServerSettingsStatus, type ServerProviderConfigInput } from "@/lib/serverSettingsStatus";
import type { BotModuleNode } from "@/lib/commands";
import type { IntegrationHealthRecord } from "@/lib/api-client";
import type { NotificationSetupReview } from "@/lib/notificationSetupReview";

const tree: BotModuleNode[] = [
    {
        module: { name: "quotes", title: "Quotes", description: "Quotes module" },
        commands: [
            { name: "add-quote", description: "Add a quote", module: "quotes" },
            { name: "random-quote", description: "Random quote", module: "quotes" },
        ],
    },
    {
        module: { name: "twitch", title: "Twitch", description: "Twitch module" },
        commands: [
            { name: "add-twitch-stream", description: "Add Twitch", module: "twitch" },
            { name: "manage-twitch-streams", description: "Manage Twitch", module: "twitch" },
        ],
    },
    {
        module: { name: "steam", title: "Steam", description: "Steam module" },
        commands: [
            { name: "add-steam-news", description: "Add Steam news", module: "steam" },
        ],
    },
];

function provider(partial: Partial<ServerProviderConfigInput>): ServerProviderConfigInput {
    return {
        providerKey: "twitch",
        providerLabel: "Twitch",
        moduleName: "twitch",
        configured: 1,
        paused: 0,
        href: "/dashboard/twitch/guild-1",
        ...partial,
    };
}

function health(partial: Partial<IntegrationHealthRecord>): IntegrationHealthRecord {
    return {
        id: 1,
        provider: "twitch",
        configId: "1",
        guildId: "guild-1",
        channelId: "channel-1",
        status: "healthy",
        consecutiveFailures: 0,
        ...partial,
    };
}

function review(partial: Partial<NotificationSetupReview>): NotificationSetupReview {
    return {
        duplicateRoutes: [],
        multiChannelFeeds: [],
        busyChannels: [],
        ...partial,
    };
}

describe("buildServerSettingsStatus", () => {
    it("counts module-level disabled commands as effectively disabled", () => {
        const status = buildServerSettingsStatus({
            tree,
            disabledModules: ["quotes"],
            disabledCommands: ["manage-twitch-streams"],
            guildId: "guild-1",
        });

        expect(status.modules.find((module) => module.moduleName === "quotes")).toMatchObject({
            enabledCommands: 0,
            disabledCommands: 2,
            disabledByModule: true,
            state: "disabled",
        });
        expect(status.modules.find((module) => module.moduleName === "twitch")).toMatchObject({
            enabledCommands: 1,
            disabledCommands: 1,
            state: "partial",
        });
        expect(status.summary).toMatchObject({
            enabledCommands: 2,
            disabledCommands: 3,
            disabledModules: 1,
            partialModules: 1,
        });
    });

    it("aggregates provider setup and health by module", () => {
        const status = buildServerSettingsStatus({
            tree,
            providerConfigs: [
                provider({ configured: 3, paused: 1 }),
                provider({
                    providerKey: "steam-news",
                    providerLabel: "Steam News",
                    moduleName: "steam",
                    configured: 2,
                    paused: 2,
                    href: "/dashboard/steam-news/guild-1",
                }),
            ],
            healthRecords: [
                health({ provider: "twitch", status: "warning" }),
                health({ provider: "steamnews", status: "error" }),
            ],
            guildId: "guild-1",
        });

        expect(status.providers.map((item) => item.providerKey)).toEqual(["steamnews", "twitch"]);
        expect(status.providers[0]).toMatchObject({
            providerLabel: "Steam News",
            configured: 2,
            active: 0,
            paused: 2,
            healthErrors: 1,
            state: "critical",
        });
        expect(status.modules.find((module) => module.moduleName === "twitch")).toMatchObject({
            configuredIntegrations: 3,
            activeIntegrations: 2,
            pausedIntegrations: 1,
            healthIssues: 1,
            state: "partial",
        });
        expect(status.summary).toMatchObject({
            configuredIntegrations: 5,
            activeIntegrations: 2,
            pausedIntegrations: 3,
            healthIssues: 2,
        });
    });

    it("summarizes notification review findings", () => {
        const status = buildServerSettingsStatus({
            tree,
            notificationReview: review({
                duplicateRoutes: [{ key: "a", provider: "Twitch", sourceLabel: "one", channelIds: ["1"], records: [] }],
                multiChannelFeeds: [{ key: "b", provider: "YouTube", sourceLabel: "two", channelIds: ["1", "2"], records: [] }],
                busyChannels: [{ channelId: "1", count: 5, providers: ["Twitch"] }],
            }),
            guildId: "guild-1",
        });

        expect(status.notificationReview).toEqual({
            duplicateRoutes: 1,
            multiChannelFeeds: 1,
            busyChannels: 1,
            totalFindings: 3,
            statusLabel: "3 findings",
        });
        expect(status.summary.notificationFindings).toBe(3);
    });

    it("returns a ready capability checklist when no setup issues are present", () => {
        const status = buildServerSettingsStatus({
            tree,
            guildId: "guild-1",
        });

        expect(status.capabilityChecklist).toMatchObject({
            issueCount: 0,
            statusLabel: "Ready",
            items: [
                expect.objectContaining({
                    id: "ready",
                    severity: "success",
                    statusLabel: "Ready",
                    href: "/dashboard/guild-1",
                }),
            ],
        });
    });

    it("builds capability checklist warnings for missing channels, health, review, paused routes, and commands", () => {
        const status = buildServerSettingsStatus({
            tree,
            disabledCommands: ["manage-twitch-streams"],
            providerConfigs: [
                provider({ configured: 3, paused: 1, missingChannels: 2 }),
                provider({
                    providerKey: "steam-news",
                    providerLabel: "Steam News",
                    moduleName: "steam",
                    configured: 1,
                    href: "/dashboard/steam-news/guild-1",
                }),
            ],
            healthRecords: [
                health({ provider: "twitch", status: "warning" }),
                health({ provider: "steamnews", status: "error" }),
            ],
            notificationReview: review({
                busyChannels: [{ channelId: "1", count: 4, providers: ["Twitch"] }],
            }),
            guildId: "guild-1",
        });

        expect(status.providers.find((item) => item.providerKey === "twitch")).toMatchObject({
            configured: 3,
            active: 0,
            paused: 1,
            missingChannels: 2,
            state: "critical",
        });
        expect(status.modules.find((module) => module.moduleName === "twitch")).toMatchObject({
            activeIntegrations: 0,
            missingChannels: 2,
            state: "partial",
        });
        expect(status.summary).toMatchObject({
            missingChannels: 2,
            healthIssues: 2,
            notificationFindings: 1,
            disabledCommands: 1,
        });
        expect(status.capabilityChecklist.issueCount).toBe(5);
        expect(status.capabilityChecklist.items.map((item) => item.id)).toEqual([
            "missing-channels",
            "provider-health",
            "notification-review",
            "paused-integrations",
            "command-access",
        ]);
        expect(status.capabilityChecklist.items[0]).toMatchObject({
            severity: "critical",
            statusLabel: "2 missing",
            href: "/dashboard/settings/guild-1/notifications",
        });
        expect(status.capabilityChecklist.items[1]).toMatchObject({
            severity: "critical",
            statusLabel: "2 issues",
            href: "/dashboard/analytics/guild-1",
        });
    });
});
