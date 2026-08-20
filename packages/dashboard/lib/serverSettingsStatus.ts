import type { BotModuleNode } from "@/lib/commands";
import type { IntegrationHealthRecord, IntegrationHealthStatus } from "@/lib/api-client";
import type { NotificationSetupReview } from "@/lib/notificationSetupReview";

export type ServerModuleState = "active" | "partial" | "disabled" | "quiet";
export type ServerProviderState = "active" | "warning" | "critical" | "paused" | "unconfigured";
export type ServerCapabilitySeverity = "success" | "warning" | "critical";

export interface ServerProviderConfigInput {
    providerKey: string;
    providerLabel: string;
    moduleName: string;
    configured: number;
    paused?: number;
    missingChannels?: number;
    href: string;
}

export interface ServerModuleStatus {
    moduleName: string;
    totalCommands: number;
    enabledCommands: number;
    disabledCommands: number;
    disabledByModule: boolean;
    configuredIntegrations: number;
    activeIntegrations: number;
    pausedIntegrations: number;
    missingChannels: number;
    healthIssues: number;
    state: ServerModuleState;
    href: string;
}

export interface ServerProviderStatus {
    providerKey: string;
    providerLabel: string;
    moduleName: string;
    configured: number;
    active: number;
    paused: number;
    missingChannels: number;
    healthErrors: number;
    healthWarnings: number;
    healthUnknown: number;
    state: ServerProviderState;
    href: string;
}

export interface ServerNotificationReviewStatus {
    duplicateRoutes: number;
    multiChannelFeeds: number;
    busyChannels: number;
    totalFindings: number;
}

export type ServerCapabilityChecklistItemId = "missing-channels" | "provider-health" | "notification-review" | "paused-integrations" | "command-access" | "ready";

export interface ServerCapabilityChecklistItem {
    id: ServerCapabilityChecklistItemId;
    severity: ServerCapabilitySeverity;
    href: string;
    count: number;
    healthErrors?: number;
    healthWarnings?: number;
    healthUnknown?: number;
    disabledModules?: number;
}

export interface ServerCapabilityChecklist {
    items: ServerCapabilityChecklistItem[];
    issueCount: number;
}

export interface ServerSettingsStatusSummary {
    totalModules: number;
    activeModules: number;
    partialModules: number;
    disabledModules: number;
    totalCommands: number;
    enabledCommands: number;
    disabledCommands: number;
    configuredIntegrations: number;
    activeIntegrations: number;
    pausedIntegrations: number;
    missingChannels: number;
    healthIssues: number;
    notificationFindings: number;
}

export interface ServerSettingsStatus {
    modules: ServerModuleStatus[];
    providers: ServerProviderStatus[];
    notificationReview: ServerNotificationReviewStatus;
    capabilityChecklist: ServerCapabilityChecklist;
    summary: ServerSettingsStatusSummary;
}

export function buildServerSettingsStatus(input: {
    tree: readonly BotModuleNode[];
    disabledModules?: readonly string[];
    disabledCommands?: readonly string[];
    providerConfigs?: readonly ServerProviderConfigInput[];
    healthRecords?: readonly IntegrationHealthRecord[];
    notificationReview?: NotificationSetupReview;
    guildId: string;
}): ServerSettingsStatus {
    const disabledModuleSet = new Set((input.disabledModules ?? []).map((moduleName) => moduleName.trim()).filter(Boolean));
    const disabledCommandSet = new Set((input.disabledCommands ?? []).map((commandName) => commandName.trim()).filter(Boolean));
    const providerConfigs = normalizeProviderConfigs(input.providerConfigs ?? []);
    const providers = buildProviderStatuses(providerConfigs, input.healthRecords ?? []);
    const providersByModule = groupProvidersByModule(providers);
    const modules = input.tree
        .filter((node) => node.commands.length > 0)
        .map((node) => buildModuleStatus({
            node,
            disabledModuleSet,
            disabledCommandSet,
            providers: providersByModule.get(node.module.name) ?? [],
            guildId: input.guildId,
        }));
    const notificationReview = buildNotificationReviewStatus(input.notificationReview);
    const capabilityChecklist = buildCapabilityChecklist({
        modules,
        providers,
        notificationReview,
        guildId: input.guildId,
    });

    return {
        modules,
        providers,
        notificationReview,
        capabilityChecklist,
        summary: buildSummary(modules, providers, notificationReview),
    };
}

function buildModuleStatus(input: {
    node: BotModuleNode;
    disabledModuleSet: ReadonlySet<string>;
    disabledCommandSet: ReadonlySet<string>;
    providers: ServerProviderStatus[];
    guildId: string;
}): ServerModuleStatus {
    const moduleName = input.node.module.name;
    const disabledByModule = input.disabledModuleSet.has(moduleName);
    const totalCommands = input.node.commands.length;
    const individuallyDisabled = input.node.commands.filter((command) => input.disabledCommandSet.has(command.name)).length;
    const disabledCommands = disabledByModule ? totalCommands : individuallyDisabled;
    const enabledCommands = disabledByModule ? 0 : Math.max(0, totalCommands - individuallyDisabled);
    const configuredIntegrations = input.providers.reduce((total, provider) => total + provider.configured, 0);
    const pausedIntegrations = input.providers.reduce((total, provider) => total + provider.paused, 0);
    const missingChannels = input.providers.reduce((total, provider) => total + provider.missingChannels, 0);
    const activeIntegrations = input.providers.reduce((total, provider) => total + provider.active, 0);
    const healthIssues = input.providers.reduce((total, provider) => total + provider.healthErrors + provider.healthWarnings + provider.healthUnknown, 0);
    const state = getModuleState({
        disabledByModule,
        totalCommands,
        enabledCommands,
        disabledCommands,
        configuredIntegrations,
        activeIntegrations,
        pausedIntegrations,
        missingChannels,
        healthIssues,
    });

    return {
        moduleName,
        totalCommands,
        enabledCommands,
        disabledCommands,
        disabledByModule,
        configuredIntegrations,
        activeIntegrations,
        pausedIntegrations,
        missingChannels,
        healthIssues,
        state,
        href: `/dashboard/commands/${encodeURIComponent(input.guildId)}`,
    };
}

function buildProviderStatuses(
    providerConfigs: readonly ServerProviderConfigInput[],
    healthRecords: readonly IntegrationHealthRecord[]
): ServerProviderStatus[] {
    const providers = new Map<string, ServerProviderStatusAccumulator>();

    for (const config of providerConfigs) {
        const provider = getProviderAccumulator(providers, config.providerKey, config.providerLabel, config.moduleName, config.href);
        provider.configured += Math.max(0, Math.floor(config.configured));
        provider.paused += Math.max(0, Math.floor(config.paused ?? 0));
        provider.missingChannels += Math.max(0, Math.floor(config.missingChannels ?? 0));
    }

    for (const record of healthRecords) {
        const providerKey = normalizeProviderKey(record.provider);
        const provider = getProviderAccumulator(
            providers,
            providerKey,
            record.provider.trim() || providerKey,
            getDefaultModuleForProvider(providerKey),
            "#",
        );
        addHealth(provider, record.status);
    }

    return [...providers.values()]
        .map((provider) => {
            const active = Math.max(0, provider.configured - provider.paused - provider.missingChannels);
            return {
                providerKey: provider.providerKey,
                providerLabel: provider.providerLabel,
                moduleName: provider.moduleName,
                configured: provider.configured,
                active,
                paused: provider.paused,
                missingChannels: provider.missingChannels,
                healthErrors: provider.healthErrors,
                healthWarnings: provider.healthWarnings,
                healthUnknown: provider.healthUnknown,
                state: getProviderState(provider, active),
                href: provider.href,
            };
        })
        .filter((provider) => provider.configured > 0 || provider.healthErrors > 0 || provider.healthWarnings > 0 || provider.healthUnknown > 0)
        .sort(compareProviders);
}

interface ServerProviderStatusAccumulator {
    providerKey: string;
    providerLabel: string;
    moduleName: string;
    href: string;
    configured: number;
    paused: number;
    missingChannels: number;
    healthErrors: number;
    healthWarnings: number;
    healthUnknown: number;
}

function normalizeProviderConfigs(providerConfigs: readonly ServerProviderConfigInput[]): ServerProviderConfigInput[] {
    return providerConfigs.map((config) => ({
        ...config,
        providerKey: normalizeProviderKey(config.providerKey),
        moduleName: config.moduleName.trim() || getDefaultModuleForProvider(config.providerKey),
        configured: Math.max(0, Math.floor(config.configured)),
        paused: Math.max(0, Math.min(Math.floor(config.paused ?? 0), Math.floor(config.configured))),
        missingChannels: Math.max(0, Math.min(Math.floor(config.missingChannels ?? 0), Math.floor(config.configured))),
    }));
}

function getProviderAccumulator(
    providers: Map<string, ServerProviderStatusAccumulator>,
    providerKey: string,
    providerLabel: string,
    moduleName: string,
    href: string
): ServerProviderStatusAccumulator {
    const normalizedKey = normalizeProviderKey(providerKey);
    const existing = providers.get(normalizedKey);
    if (existing) {
        if (existing.href === "#" && href !== "#") existing.href = href;
        return existing;
    }

    const provider = {
        providerKey: normalizedKey,
        providerLabel,
        moduleName,
        href,
        configured: 0,
        paused: 0,
        missingChannels: 0,
        healthErrors: 0,
        healthWarnings: 0,
        healthUnknown: 0,
    };
    providers.set(normalizedKey, provider);
    return provider;
}

function addHealth(provider: ServerProviderStatusAccumulator, status: IntegrationHealthStatus): void {
    if (status === "error") {
        provider.healthErrors += 1;
    } else if (status === "warning") {
        provider.healthWarnings += 1;
    } else if (status === "unknown") {
        provider.healthUnknown += 1;
    }
}

function groupProvidersByModule(providers: readonly ServerProviderStatus[]): Map<string, ServerProviderStatus[]> {
    const byModule = new Map<string, ServerProviderStatus[]>();
    for (const provider of providers) {
        byModule.set(provider.moduleName, [...(byModule.get(provider.moduleName) ?? []), provider]);
    }
    return byModule;
}

function buildNotificationReviewStatus(review?: NotificationSetupReview): ServerNotificationReviewStatus {
    const duplicateRoutes = review?.duplicateRoutes.length ?? 0;
    const multiChannelFeeds = review?.multiChannelFeeds.length ?? 0;
    const busyChannels = review?.busyChannels.length ?? 0;
    const totalFindings = duplicateRoutes + multiChannelFeeds + busyChannels;
    return {
        duplicateRoutes,
        multiChannelFeeds,
        busyChannels,
        totalFindings,
    };
}

function buildCapabilityChecklist(input: {
    modules: readonly ServerModuleStatus[];
    providers: readonly ServerProviderStatus[];
    notificationReview: ServerNotificationReviewStatus;
    guildId: string;
}): ServerCapabilityChecklist {
    const encodedGuildId = encodeURIComponent(input.guildId);
    const notificationSetupHref = `/dashboard/settings/${encodedGuildId}/notifications`;
    const analyticsHref = `/dashboard/analytics/${encodedGuildId}`;
    const commandsHref = `/dashboard/commands/${encodedGuildId}`;
    const missingChannels = input.providers.reduce((total, provider) => total + provider.missingChannels, 0);
    const pausedIntegrations = input.providers.reduce((total, provider) => total + provider.paused, 0);
    const healthErrors = input.providers.reduce((total, provider) => total + provider.healthErrors, 0);
    const healthWarnings = input.providers.reduce((total, provider) => total + provider.healthWarnings, 0);
    const healthUnknown = input.providers.reduce((total, provider) => total + provider.healthUnknown, 0);
    const disabledModules = input.modules.filter((module) => module.disabledByModule).length;
    const disabledCommands = input.modules.reduce((total, module) => total + module.disabledCommands, 0);
    const items: ServerCapabilityChecklistItem[] = [];

    if (missingChannels > 0) {
        items.push({
            id: "missing-channels",
            severity: "critical",
            href: notificationSetupHref,
            count: missingChannels,
        });
    }

    if (healthErrors > 0 || healthWarnings > 0 || healthUnknown > 0) {
        const healthIssues = healthErrors + healthWarnings + healthUnknown;
        items.push({
            id: "provider-health",
            severity: healthErrors > 0 ? "critical" : "warning",
            href: analyticsHref,
            count: healthIssues,
            healthErrors,
            healthWarnings,
            healthUnknown,
        });
    }

    if (input.notificationReview.totalFindings > 0) {
        items.push({
            id: "notification-review",
            severity: "warning",
            href: notificationSetupHref,
            count: input.notificationReview.totalFindings,
        });
    }

    if (pausedIntegrations > 0) {
        items.push({
            id: "paused-integrations",
            severity: "warning",
            href: notificationSetupHref,
            count: pausedIntegrations,
        });
    }

    if (disabledModules > 0 || disabledCommands > 0) {
        items.push({
            id: "command-access",
            severity: "warning",
            href: commandsHref,
            count: disabledCommands,
            disabledModules,
        });
    }

    if (items.length === 0) {
        items.push({
            id: "ready",
            severity: "success",
            href: `/dashboard/${encodedGuildId}`,
            count: 0,
        });
    }

    const sortedItems = [...items].sort(compareCapabilityItems);
    const issueCount = sortedItems.filter((item) => item.severity !== "success").length;
    return {
        items: sortedItems,
        issueCount,
    };
}

function buildSummary(
    modules: readonly ServerModuleStatus[],
    providers: readonly ServerProviderStatus[],
    notificationReview: ServerNotificationReviewStatus
): ServerSettingsStatusSummary {
    return {
        totalModules: modules.length,
        activeModules: modules.filter((module) => module.state === "active").length,
        partialModules: modules.filter((module) => module.state === "partial").length,
        disabledModules: modules.filter((module) => module.state === "disabled").length,
        totalCommands: modules.reduce((total, module) => total + module.totalCommands, 0),
        enabledCommands: modules.reduce((total, module) => total + module.enabledCommands, 0),
        disabledCommands: modules.reduce((total, module) => total + module.disabledCommands, 0),
        configuredIntegrations: providers.reduce((total, provider) => total + provider.configured, 0),
        activeIntegrations: providers.reduce((total, provider) => total + provider.active, 0),
        pausedIntegrations: providers.reduce((total, provider) => total + provider.paused, 0),
        missingChannels: providers.reduce((total, provider) => total + provider.missingChannels, 0),
        healthIssues: providers.reduce((total, provider) => total + provider.healthErrors + provider.healthWarnings + provider.healthUnknown, 0),
        notificationFindings: notificationReview.totalFindings,
    };
}

function getModuleState(input: {
    disabledByModule: boolean;
    totalCommands: number;
    enabledCommands: number;
    disabledCommands: number;
    configuredIntegrations: number;
    activeIntegrations: number;
    pausedIntegrations: number;
    missingChannels: number;
    healthIssues: number;
}): ServerModuleState {
    if (input.disabledByModule || input.enabledCommands === 0) return "disabled";
    if (input.totalCommands === 0) return "quiet";
    if (input.disabledCommands > 0 || input.healthIssues > 0 || input.missingChannels > 0) return "partial";
    if (input.configuredIntegrations > 0 && input.activeIntegrations === 0 && input.pausedIntegrations > 0) return "partial";
    return "active";
}

function getProviderState(provider: ServerProviderStatusAccumulator, active: number): ServerProviderState {
    if (provider.healthErrors > 0) return "critical";
    if (provider.missingChannels > 0) return "critical";
    if (provider.healthWarnings > 0 || provider.healthUnknown > 0) return "warning";
    if (provider.configured === 0) return "unconfigured";
    if (active === 0 && provider.paused > 0) return "paused";
    return "active";
}

function compareProviders(left: ServerProviderStatus, right: ServerProviderStatus): number {
    return getProviderRank(right.state) - getProviderRank(left.state)
        || right.configured - left.configured
        || left.providerLabel.localeCompare(right.providerLabel);
}

function compareCapabilityItems(left: ServerCapabilityChecklistItem, right: ServerCapabilityChecklistItem): number {
    return getCapabilitySeverityRank(right.severity) - getCapabilitySeverityRank(left.severity)
        || getCapabilityItemOrder(left.id) - getCapabilityItemOrder(right.id);
}

function getCapabilitySeverityRank(severity: ServerCapabilitySeverity): number {
    if (severity === "critical") return 2;
    if (severity === "warning") return 1;
    return 0;
}

function getCapabilityItemOrder(id: string): number {
    if (id === "missing-channels") return 0;
    if (id === "provider-health") return 1;
    if (id === "notification-review") return 2;
    if (id === "paused-integrations") return 3;
    if (id === "command-access") return 4;
    return 5;
}

function getProviderRank(state: ServerProviderState): number {
    if (state === "critical") return 4;
    if (state === "warning") return 3;
    if (state === "paused") return 2;
    if (state === "active") return 1;
    return 0;
}

function normalizeProviderKey(provider: string): string {
    const normalized = provider.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    if (normalized === "steam") return "steamnews";
    return normalized || "unknown";
}

function getDefaultModuleForProvider(providerKey: string): string {
    const normalized = normalizeProviderKey(providerKey);
    if (normalized === "steamnews") return "steam";
    if (normalized === "birthday") return "birthdays";
    if (normalized === "quoteofday") return "quotes";
    return normalized;
}
