export type NotificationConfigStatusFilter = "all" | "active" | "paused" | "healthy" | "warning" | "error" | "unknown";

export interface NotificationFilterConfig {
    id?: number | string | null;
    discordChannelId?: string | null;
    customMessage?: string | null;
    paused?: boolean | null;
}

export interface NotificationFilterHealth {
    status?: string | null;
}

export interface FilterNotificationConfigsInput<T extends NotificationFilterConfig> {
    configs: readonly T[];
    channelNameField: string;
    getChannelName: (channelId: string) => string;
    healthByConfigId?: Map<string, NotificationFilterHealth>;
    query?: string;
    status?: NotificationConfigStatusFilter;
}

export function filterNotificationConfigs<T extends NotificationFilterConfig>({
    configs,
    channelNameField,
    getChannelName,
    healthByConfigId,
    query = "",
    status = "all",
}: FilterNotificationConfigsInput<T>): T[] {
    const normalizedQuery = normalize(query);

    return configs.filter((config) => (
        matchesStatus(config, status, healthByConfigId)
        && matchesQuery(config, channelNameField, getChannelName, normalizedQuery)
    ));
}

function matchesStatus<T extends NotificationFilterConfig>(
    config: T,
    status: NotificationConfigStatusFilter,
    healthByConfigId: Map<string, NotificationFilterHealth> | undefined
): boolean {
    if (status === "all") return true;

    const paused = Boolean(config.paused);
    if (status === "active") return !paused;
    if (status === "paused") return paused;
    if (paused) return false;

    const health = getHealthStatus(config, healthByConfigId);
    if (status === "unknown") return health === "unknown";
    return health === status;
}

function getHealthStatus<T extends NotificationFilterConfig>(
    config: T,
    healthByConfigId: Map<string, NotificationFilterHealth> | undefined
): string {
    if (!healthByConfigId || config.id === undefined || config.id === null) return "unknown";
    const status = healthByConfigId.get(String(config.id))?.status;
    return typeof status === "string" && status.length > 0 ? status : "unknown";
}

function matchesQuery<T extends NotificationFilterConfig>(
    config: T,
    channelNameField: string,
    getChannelName: (channelId: string) => string,
    normalizedQuery: string
): boolean {
    if (!normalizedQuery) return true;

    const channelId = config.discordChannelId ?? "";
    const record = config as Record<string, unknown>;
    const values = [
        config.id,
        record[channelNameField],
        record.youtubeChannelTitle,
        channelId,
        getChannelName(channelId),
        config.customMessage,
    ];

    return values.some((value) => normalize(value).includes(normalizedQuery));
}

function normalize(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}
