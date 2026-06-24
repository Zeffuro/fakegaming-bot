import type { BotModuleNode } from "@/lib/commands";
import type { IntegrationHealthRecord, IntegrationHealthStatus } from "@/lib/api-client";
import type { NotificationSetupReview } from "@/lib/notificationSetupReview";

export type ServerModuleState = "active" | "partial" | "disabled" | "quiet";
export type ServerProviderState = "active" | "warning" | "critical" | "paused" | "unconfigured";

export interface ServerProviderConfigInput {
    providerKey: string;
    providerLabel: string;
    moduleName: string;
    configured: number;
    paused?: number;
    href: string;
}

export interface ServerModuleStatus {
    moduleName: string;
    title: string;
    description: string;
    totalCommands: number;
    enabledCommands: number;
    disabledCommands: number;
    disabledByModule: boolean;
    configuredIntegrations: number;
    activeIntegrations: number;
    pausedIntegrations: number;
    healthIssues: number;
    state: ServerModuleState;
    statusLabel: string;
    detail: string;
    href: string;
}

export interface ServerProviderStatus {
    providerKey: string;
    providerLabel: string;
    moduleName: string;
    configured: number;
    active: number;
    paused: number;
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
    statusLabel: string;
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
    healthIssues: number;
    notificationFindings: number;
}

export interface ServerSettingsStatus {
    modules: ServerModuleStatus[];
    providers: ServerProviderStatus[];
    notificationReview: ServerNotificationReviewStatus;
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

    return {
        modules,
        providers,
        notificationReview,
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
        healthIssues,
    });

    return {
        moduleName,
        title: input.node.module.title,
        description: input.node.module.description,
        totalCommands,
        enabledCommands,
        disabledCommands,
        disabledByModule,
        configuredIntegrations,
        activeIntegrations,
        pausedIntegrations,
        healthIssues,
        state,
        statusLabel: getModuleStatusLabel(state),
        detail: buildModuleDetail({
            enabledCommands,
            totalCommands,
            disabledByModule,
            configuredIntegrations,
            activeIntegrations,
            pausedIntegrations,
            healthIssues,
        }),
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
    }

    for (const record of healthRecords) {
        const providerKey = normalizeProviderKey(record.provider);
        const provider = getProviderAccumulator(
            providers,
            providerKey,
            getProviderLabel(record.provider),
            getDefaultModuleForProvider(providerKey),
            "#",
        );
        addHealth(provider, record.status);
    }

    return [...providers.values()]
        .map((provider) => {
            const active = Math.max(0, provider.configured - provider.paused);
            return {
                providerKey: provider.providerKey,
                providerLabel: provider.providerLabel,
                moduleName: provider.moduleName,
                configured: provider.configured,
                active,
                paused: provider.paused,
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
        statusLabel: totalFindings === 0 ? "Clear" : `${totalFindings} ${totalFindings === 1 ? "finding" : "findings"}`,
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
    healthIssues: number;
}): ServerModuleState {
    if (input.disabledByModule || input.enabledCommands === 0) return "disabled";
    if (input.totalCommands === 0) return "quiet";
    if (input.disabledCommands > 0 || input.healthIssues > 0) return "partial";
    if (input.configuredIntegrations > 0 && input.activeIntegrations === 0 && input.pausedIntegrations > 0) return "partial";
    return "active";
}

function getProviderState(provider: ServerProviderStatusAccumulator, active: number): ServerProviderState {
    if (provider.healthErrors > 0) return "critical";
    if (provider.healthWarnings > 0 || provider.healthUnknown > 0) return "warning";
    if (provider.configured === 0) return "unconfigured";
    if (active === 0 && provider.paused > 0) return "paused";
    return "active";
}

function getModuleStatusLabel(state: ServerModuleState): string {
    if (state === "active") return "Active";
    if (state === "partial") return "Needs review";
    if (state === "disabled") return "Disabled";
    return "Quiet";
}

function buildModuleDetail(input: {
    enabledCommands: number;
    totalCommands: number;
    disabledByModule: boolean;
    configuredIntegrations: number;
    activeIntegrations: number;
    pausedIntegrations: number;
    healthIssues: number;
}): string {
    if (input.disabledByModule) return `Module disabled. 0/${input.totalCommands} commands enabled.`;
    const parts = [`${input.enabledCommands}/${input.totalCommands} commands enabled`];
    if (input.configuredIntegrations > 0) {
        parts.push(`${input.activeIntegrations}/${input.configuredIntegrations} integrations active`);
    }
    if (input.pausedIntegrations > 0) {
        parts.push(`${input.pausedIntegrations} paused`);
    }
    if (input.healthIssues > 0) {
        parts.push(`${input.healthIssues} health ${input.healthIssues === 1 ? "issue" : "issues"}`);
    }
    return `${parts.join(". ")}.`;
}

function compareProviders(left: ServerProviderStatus, right: ServerProviderStatus): number {
    return getProviderRank(right.state) - getProviderRank(left.state)
        || right.configured - left.configured
        || left.providerLabel.localeCompare(right.providerLabel);
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

function getProviderLabel(provider: string): string {
    const normalized = normalizeProviderKey(provider);
    if (normalized === "twitch") return "Twitch";
    if (normalized === "youtube") return "YouTube";
    if (normalized === "steamnews") return "Steam News";
    if (normalized === "tiktok") return "TikTok";
    if (normalized === "bluesky") return "Bluesky";
    if (normalized === "patchnotes") return "Patch Notes";
    if (normalized === "anime") return "Anime";
    if (normalized === "birthday") return "Birthdays";
    if (normalized === "quoteofday") return "Quote of the Day";
    return provider.trim() || "Unknown";
}

function getDefaultModuleForProvider(providerKey: string): string {
    const normalized = normalizeProviderKey(providerKey);
    if (normalized === "steamnews") return "steam";
    if (normalized === "birthday") return "birthdays";
    if (normalized === "quoteofday") return "quotes";
    return normalized;
}
