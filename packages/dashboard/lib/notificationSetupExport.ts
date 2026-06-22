import type { NotificationSetupReview } from "@/lib/notificationSetupReview";

export interface NotificationSetupExportRecord {
    provider: string;
    id?: string | number;
    source: string;
    sourceId?: string | null;
    channelId: string;
    paused?: boolean | null;
    customMessage?: string | null;
    cooldownMinutes?: number | null;
    reminderMinutes?: number | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    birthday?: {
        day: number;
        month: number;
        year?: number | null;
    } | null;
}

export interface NotificationSetupExport {
    version: 1;
    guildId: string;
    exportedAt: string;
    totals: {
        records: number;
        duplicateRoutes: number;
        multiChannelFeeds: number;
        busyChannels: number;
    };
    records: NotificationSetupExportRecord[];
    review: NotificationSetupReview;
}

interface BuildNotificationSetupExportInput {
    guildId: string;
    exportedAt?: string;
    review: NotificationSetupReview;
    twitch: Array<Record<string, unknown>>;
    youtube: Array<Record<string, unknown>>;
    tiktok: Array<Record<string, unknown>>;
    bluesky: Array<Record<string, unknown>>;
    steamNews: Array<Record<string, unknown>>;
    patchNotes: Array<Record<string, unknown>>;
    anime: Array<Record<string, unknown>>;
    birthdays: Array<Record<string, unknown>>;
}

export function buildNotificationSetupExport(input: BuildNotificationSetupExportInput): NotificationSetupExport {
    const records = [
        ...input.twitch.map((config) => toExportRecord("Twitch", config, ["twitchUsername"], "discordChannelId")),
        ...input.youtube.map((config) => toExportRecord("YouTube", config, ["youtubeChannelTitle", "youtubeChannelId"], "discordChannelId", ["youtubeChannelId"])),
        ...input.tiktok.map((config) => toExportRecord("TikTok", config, ["tiktokUsername"], "discordChannelId")),
        ...input.bluesky.map((config) => toExportRecord("Bluesky", config, ["blueskyHandle"], "discordChannelId")),
        ...input.steamNews.map((config) => toExportRecord("Steam News", config, ["appName", "youtubeChannelTitle", "steamAppId"], "discordChannelId", ["steamAppId"])),
        ...input.patchNotes.map((config) => toExportRecord("Patch Notes", config, ["game"], "discordChannelId")),
        ...input.anime.map((config) => withReminderMinutes(toExportRecord("Anime", config, ["animeTitle", "title", "anilistId"], "discordChannelId", ["anilistId", "animeTitle", "title"]), config)),
        ...input.birthdays.map((config) => withBirthday(toExportRecord("Birthdays", config, ["userId"], "channelId"), config)),
    ].filter((record): record is NotificationSetupExportRecord => record !== null);

    return {
        version: 1,
        guildId: input.guildId,
        exportedAt: input.exportedAt ?? new Date().toISOString(),
        totals: {
            records: records.length,
            duplicateRoutes: input.review.duplicateRoutes.length,
            multiChannelFeeds: input.review.multiChannelFeeds.length,
            busyChannels: input.review.busyChannels.length,
        },
        records,
        review: input.review,
    };
}

export function buildNotificationSetupExportFilename(guildId: string, date: Date = new Date()): string {
    const day = date.toISOString().slice(0, 10);
    const safeGuildId = guildId.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `notification-setup-${safeGuildId}-${day}.json`;
}

function toExportRecord(
    provider: string,
    config: Record<string, unknown>,
    sourceFields: string[],
    channelField: string,
    sourceIdFields: string[] = sourceFields
): NotificationSetupExportRecord | null {
    const source = sourceFields.map((field) => normalizeString(config[field])).find((value): value is string => Boolean(value)) ?? null;
    const sourceId = sourceIdFields.map((field) => normalizeString(config[field])).find((value): value is string => Boolean(value)) ?? null;
    const channelId = normalizeString(config[channelField]);
    if (!source || !channelId) return null;

    return {
        provider,
        ...optionalId(config.id),
        source,
        sourceId,
        channelId,
        paused: typeof config.paused === "boolean" ? config.paused : null,
        customMessage: normalizeString(config.customMessage),
        cooldownMinutes: normalizeNumber(config.cooldownMinutes),
        quietHoursStart: normalizeString(config.quietHoursStart),
        quietHoursEnd: normalizeString(config.quietHoursEnd),
    };
}

function optionalId(value: unknown): Pick<NotificationSetupExportRecord, "id"> {
    return typeof value === "string" || typeof value === "number" ? { id: value } : {};
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function withReminderMinutes(record: NotificationSetupExportRecord | null, config: Record<string, unknown>): NotificationSetupExportRecord | null {
    if (!record) return null;
    return {
        ...record,
        reminderMinutes: normalizeNumber(config.reminderMinutes) ?? normalizeNumber(config.cooldownMinutes),
    };
}

function withBirthday(record: NotificationSetupExportRecord | null, config: Record<string, unknown>): NotificationSetupExportRecord | null {
    if (!record) return null;

    const day = normalizeNumber(config.day);
    const month = normalizeNumber(config.month);
    if (day === null || month === null) {
        return record;
    }

    return {
        ...record,
        birthday: {
            day,
            month,
            year: normalizeNumber(config.year),
        },
    };
}
