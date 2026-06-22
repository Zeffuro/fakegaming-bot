import type {
    IntegrationHealthRecord,
    NotificationDeliveryRecord,
    NotificationProviderSummary,
} from "@/lib/api-client";

export type GuildAnalyticsHealthStatus = "healthy" | "warning" | "critical" | "quiet";

export interface GuildAnalyticsConfigRecord {
    providerKey: string;
    providerLabel: string;
    configId: string;
    paused?: boolean | null;
}

export interface GuildAnalyticsProvider {
    providerKey: string;
    providerLabel: string;
    configured: number;
    active: number;
    paused: number;
    deliveries: number;
    healthErrors: number;
    healthWarnings: number;
    healthUnknown: number;
    healthHealthy: number;
    lastDeliveryAt: string | null;
    status: GuildAnalyticsHealthStatus;
}

export interface GuildAnalyticsTrendPoint {
    date: string;
    deliveries: number;
}

export interface GuildNotificationAnalytics {
    totalConfigured: number;
    activeConfigs: number;
    pausedConfigs: number;
    totalDeliveries: number;
    healthErrors: number;
    healthWarnings: number;
    lastDeliveryAt: string | null;
    providers: GuildAnalyticsProvider[];
    trend: GuildAnalyticsTrendPoint[];
}

const defaultTrendDays = 7;

export function buildGuildNotificationAnalytics(input: {
    configs?: GuildAnalyticsConfigRecord[];
    healthRecords?: IntegrationHealthRecord[];
    notificationRecords?: NotificationDeliveryRecord[];
    notificationProviders?: NotificationProviderSummary[];
    now?: Date;
    trendDays?: number;
}): GuildNotificationAnalytics {
    const configs = input.configs ?? [];
    const healthRecords = input.healthRecords ?? [];
    const notificationRecords = input.notificationRecords ?? [];
    const notificationProviders = input.notificationProviders ?? [];
    const providerStats = new Map<string, GuildAnalyticsProviderAccumulator>();
    const healthByProviderConfig = new Map<string, IntegrationHealthRecord>();

    for (const record of healthRecords) {
        healthByProviderConfig.set(getProviderConfigKey(record.provider, record.configId), record);
        getProviderAccumulator(providerStats, record.provider, getProviderLabel(record.provider));
    }

    for (const config of configs) {
        const provider = getProviderAccumulator(providerStats, config.providerKey, config.providerLabel);
        provider.configured += 1;
        if (config.paused) {
            provider.paused += 1;
        } else {
            provider.active += 1;
        }

        const health = healthByProviderConfig.get(getProviderConfigKey(config.providerKey, config.configId));
        if (health) {
            addProviderHealth(provider, health.status);
        }
    }

    for (const record of healthRecords) {
        if (configs.some((config) => getProviderConfigKey(config.providerKey, config.configId) === getProviderConfigKey(record.provider, record.configId))) {
            continue;
        }

        const provider = getProviderAccumulator(providerStats, record.provider, getProviderLabel(record.provider));
        addProviderHealth(provider, record.status);
    }

    for (const item of notificationProviders) {
        const provider = getProviderAccumulator(providerStats, item.provider, getProviderLabel(item.provider));
        provider.deliveries += Math.max(0, item.count);
    }

    for (const record of notificationRecords) {
        const provider = getProviderAccumulator(providerStats, record.provider, getProviderLabel(record.provider));
        provider.lastDeliveryAt = getLatestIsoTimestamp(provider.lastDeliveryAt, record.createdAt ?? null);
    }

    const providers = [...providerStats.values()]
        .map(toProviderAnalytics)
        .filter((provider) => provider.configured > 0 || provider.deliveries > 0 || provider.healthErrors > 0 || provider.healthWarnings > 0 || provider.healthUnknown > 0)
        .sort(compareProviders);

    return {
        totalConfigured: configs.length,
        activeConfigs: configs.filter((config) => !config.paused).length,
        pausedConfigs: configs.filter((config) => Boolean(config.paused)).length,
        totalDeliveries: notificationProviders.reduce((total, item) => total + Math.max(0, item.count), 0),
        healthErrors: providers.reduce((total, provider) => total + provider.healthErrors, 0),
        healthWarnings: providers.reduce((total, provider) => total + provider.healthWarnings + provider.healthUnknown, 0),
        lastDeliveryAt: notificationRecords.reduce<string | null>((latest, record) => getLatestIsoTimestamp(latest, record.createdAt ?? null), null),
        providers,
        trend: buildDeliveryTrend(notificationRecords, input.now ?? new Date(), input.trendDays ?? defaultTrendDays),
    };
}

interface GuildAnalyticsProviderAccumulator {
    providerKey: string;
    providerLabel: string;
    configured: number;
    active: number;
    paused: number;
    deliveries: number;
    healthErrors: number;
    healthWarnings: number;
    healthUnknown: number;
    healthHealthy: number;
    lastDeliveryAt: string | null;
}

function getProviderAccumulator(
    providers: Map<string, GuildAnalyticsProviderAccumulator>,
    providerKey: string,
    providerLabel: string
): GuildAnalyticsProviderAccumulator {
    const normalizedKey = normalizeProviderKey(providerKey);
    const existing = providers.get(normalizedKey);
    if (existing) return existing;

    const provider = {
        providerKey: normalizedKey,
        providerLabel,
        configured: 0,
        active: 0,
        paused: 0,
        deliveries: 0,
        healthErrors: 0,
        healthWarnings: 0,
        healthUnknown: 0,
        healthHealthy: 0,
        lastDeliveryAt: null,
    };
    providers.set(normalizedKey, provider);
    return provider;
}

function addProviderHealth(provider: GuildAnalyticsProviderAccumulator, status: IntegrationHealthRecord["status"]): void {
    if (status === "error") {
        provider.healthErrors += 1;
    } else if (status === "warning") {
        provider.healthWarnings += 1;
    } else if (status === "unknown") {
        provider.healthUnknown += 1;
    } else if (status === "healthy") {
        provider.healthHealthy += 1;
    }
}

function toProviderAnalytics(provider: GuildAnalyticsProviderAccumulator): GuildAnalyticsProvider {
    return {
        ...provider,
        status: getProviderStatus(provider),
    };
}

function getProviderStatus(provider: GuildAnalyticsProviderAccumulator): GuildAnalyticsHealthStatus {
    if (provider.healthErrors > 0) return "critical";
    if (provider.healthWarnings > 0 || provider.healthUnknown > 0) return "warning";
    if (provider.configured === 0 && provider.deliveries === 0) return "quiet";
    return "healthy";
}

function buildDeliveryTrend(records: NotificationDeliveryRecord[], now: Date, days: number): GuildAnalyticsTrendPoint[] {
    const safeDays = Math.max(1, Math.min(31, Math.floor(days)));
    const end = startOfUtcDay(now);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - safeDays + 1);

    const counts = new Map<string, number>();
    for (let index = 0; index < safeDays; index += 1) {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + index);
        counts.set(formatUtcDate(date), 0);
    }

    for (const record of records) {
        if (!record.createdAt) continue;
        const parsed = new Date(record.createdAt);
        if (Number.isNaN(parsed.getTime()) || parsed < start || parsed > new Date(end.getTime() + 86399999)) continue;
        const key = formatUtcDate(parsed);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()].map(([date, deliveries]) => ({ date, deliveries }));
}

function compareProviders(a: GuildAnalyticsProvider, b: GuildAnalyticsProvider): number {
    return getStatusRank(b.status) - getStatusRank(a.status)
        || b.configured - a.configured
        || b.deliveries - a.deliveries
        || a.providerLabel.localeCompare(b.providerLabel);
}

function getStatusRank(status: GuildAnalyticsHealthStatus): number {
    if (status === "critical") return 3;
    if (status === "warning") return 2;
    if (status === "healthy") return 1;
    return 0;
}

function getLatestIsoTimestamp(current: string | null, candidate: string | null): string | null {
    if (!candidate) return current;
    const parsedCandidate = new Date(candidate);
    if (Number.isNaN(parsedCandidate.getTime())) return current;
    if (!current) return parsedCandidate.toISOString();
    const parsedCurrent = new Date(current);
    if (Number.isNaN(parsedCurrent.getTime())) return parsedCandidate.toISOString();
    return parsedCandidate > parsedCurrent ? parsedCandidate.toISOString() : parsedCurrent.toISOString();
}

function getProviderConfigKey(provider: string, configId: string): string {
    return `${normalizeProviderKey(provider)}:${configId}`;
}

function normalizeProviderKey(provider: string): string {
    const normalized = provider.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
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
    return provider.trim() || "Unknown";
}

function startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function formatUtcDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}
