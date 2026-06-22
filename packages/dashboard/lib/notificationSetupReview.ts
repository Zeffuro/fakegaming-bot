export interface NotificationReviewRecord {
    provider: string;
    sourceKey: string;
    sourceLabel: string;
    channelId: string;
    paused?: boolean | null;
}

export interface NotificationReviewGroup {
    key: string;
    provider: string;
    sourceLabel: string;
    channelIds: string[];
    records: NotificationReviewRecord[];
}

export interface NotificationChannelLoad {
    channelId: string;
    count: number;
    providers: string[];
}

export interface NotificationSetupReview {
    duplicateRoutes: NotificationReviewGroup[];
    multiChannelFeeds: NotificationReviewGroup[];
    busyChannels: NotificationChannelLoad[];
}

interface BuildNotificationSetupReviewInput {
    twitch: Array<Record<string, unknown>>;
    youtube: Array<Record<string, unknown>>;
    tiktok: Array<Record<string, unknown>>;
    bluesky: Array<Record<string, unknown>>;
    patchNotes: Array<Record<string, unknown>>;
    anime: Array<Record<string, unknown>>;
    birthdays: Array<Record<string, unknown>>;
}

export function buildNotificationSetupReview(input: BuildNotificationSetupReviewInput): NotificationSetupReview {
    const records = [
        ...input.twitch.map((config) => toRecord("Twitch", config, "twitchUsername", "discordChannelId")),
        ...input.youtube.map((config) => toRecord("YouTube", config, "youtubeChannelId", "discordChannelId")),
        ...input.tiktok.map((config) => toRecord("TikTok", config, "tiktokUsername", "discordChannelId")),
        ...input.bluesky.map((config) => toRecord("Bluesky", config, "blueskyHandle", "discordChannelId")),
        ...input.patchNotes.map((config) => toRecord("Patch Notes", config, "game", "discordChannelId")),
        ...input.anime.map((config) => toRecord("Anime", config, ["animeTitle", "title", "anilistId"], "discordChannelId")),
        ...input.birthdays.map((config) => toRecord("Birthdays", config, "userId", "channelId")),
    ].filter((record): record is NotificationReviewRecord => record !== null);

    return {
        duplicateRoutes: findDuplicateRoutes(records),
        multiChannelFeeds: findMultiChannelFeeds(records),
        busyChannels: findBusyChannels(records),
    };
}

function toRecord(
    provider: string,
    config: Record<string, unknown>,
    sourceField: string | string[],
    channelField: string
): NotificationReviewRecord | null {
    const sourceLabel = Array.isArray(sourceField)
        ? sourceField.map((field) => normalizeLabel(config[field])).find((value): value is string => Boolean(value)) ?? null
        : normalizeLabel(config[sourceField]);
    const channelId = normalizeLabel(config[channelField]);
    if (!sourceLabel || !channelId) return null;

    return {
        provider,
        sourceKey: sourceLabel.toLowerCase(),
        sourceLabel,
        channelId,
        paused: typeof config.paused === "boolean" ? config.paused : null,
    };
}

function findDuplicateRoutes(records: NotificationReviewRecord[]): NotificationReviewGroup[] {
    return toSortedGroups(records, (record) => `${record.provider}:${record.sourceKey}:${record.channelId}`)
        .filter((group) => group.records.length > 1);
}

function findMultiChannelFeeds(records: NotificationReviewRecord[]): NotificationReviewGroup[] {
    return toSortedGroups(records, (record) => `${record.provider}:${record.sourceKey}`)
        .filter((group) => group.channelIds.length > 1);
}

function findBusyChannels(records: NotificationReviewRecord[]): NotificationChannelLoad[] {
    const groups = new Map<string, NotificationReviewRecord[]>();
    for (const record of records) {
        groups.set(record.channelId, [...(groups.get(record.channelId) ?? []), record]);
    }

    return [...groups.entries()]
        .map(([channelId, channelRecords]) => ({
            channelId,
            count: channelRecords.length,
            providers: [...new Set(channelRecords.map((record) => record.provider))].sort(),
        }))
        .filter((channel) => channel.count >= 5)
        .sort((a, b) => b.count - a.count || a.channelId.localeCompare(b.channelId));
}

function toSortedGroups(
    records: NotificationReviewRecord[],
    getKey: (record: NotificationReviewRecord) => string
): NotificationReviewGroup[] {
    const groups = new Map<string, NotificationReviewRecord[]>();
    for (const record of records) {
        const key = getKey(record);
        groups.set(key, [...(groups.get(key) ?? []), record]);
    }

    return [...groups.entries()]
        .map(([key, groupRecords]) => ({
            key,
            provider: groupRecords[0]?.provider ?? "Unknown",
            sourceLabel: groupRecords[0]?.sourceLabel ?? "Unknown",
            channelIds: [...new Set(groupRecords.map((record) => record.channelId))].sort(),
            records: groupRecords,
        }))
        .sort((a, b) => b.records.length - a.records.length || a.key.localeCompare(b.key));
}

function normalizeLabel(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}
