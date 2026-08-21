import type { NotificationSetupExport, NotificationSetupExportRecord } from "@/lib/notificationSetupExport";
import { formatDashboardMessage, type DashboardMessageKey } from "@/lib/i18n/messages";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

export type NotificationSetupImportProvider = "Twitch" | "YouTube" | "TikTok" | "Bluesky" | "Steam News" | "Patch Notes" | "Anime" | "Birthdays";
export type NotificationSetupImportSkipReason = "duplicate" | "unsupported" | "invalid";

export interface NotificationSetupImportItem {
    key: string;
    record: NotificationSetupExportRecord;
}

export interface NotificationSetupImportSkippedItem extends NotificationSetupImportItem {
    reason: NotificationSetupImportSkipReason;
    message: string;
}

export interface NotificationSetupImportPlan {
    sourceGuildId: string;
    currentGuildId: string;
    warnings: string[];
    ready: NotificationSetupImportItem[];
    skipped: NotificationSetupImportSkippedItem[];
    totals: {
        records: number;
        ready: number;
        duplicate: number;
        unsupported: number;
        invalid: number;
    };
}

export interface NotificationSetupImportCreatePayload {
    provider: NotificationSetupImportProvider;
    payload: Record<string, unknown>;
}

const supportedProviders = new Set<string>(["Twitch", "YouTube", "TikTok", "Bluesky", "Steam News", "Patch Notes", "Anime", "Birthdays"]);
const youtubeChannelIdPattern = /^UC[\w-]{22}$/;
const hhmmPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type NotificationImportMessageKey = Extract<DashboardMessageKey, `setupTemplates.importCopy.${string}`>;

function getNotificationImportMessage(
    locale: DashboardLocale,
    key: NotificationImportMessageKey,
    values?: Record<string, string | number>,
): string {
    return formatDashboardMessage(locale, key, values);
}

export function parseNotificationSetupImportJson(text: string, locale: DashboardLocale = "en"): NotificationSetupExport {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.invalidJson"));
    }

    if (!isRecord(parsed)) {
        throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.invalidObject"));
    }
    if (parsed.version !== 1) {
        throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.unsupportedVersion"));
    }
    if (typeof parsed.guildId !== "string" || parsed.guildId.trim().length === 0) {
        throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.missingGuildId"));
    }
    if (!Array.isArray(parsed.records)) {
        throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.missingRecords"));
    }

    return parsed as unknown as NotificationSetupExport;
}

export function buildNotificationSetupImportPlan(input: {
    exportPayload: NotificationSetupExport;
    currentGuildId: string;
    currentRecords: NotificationSetupExportRecord[];
}, locale: DashboardLocale = "en"): NotificationSetupImportPlan {
    const sourceGuildId = input.exportPayload.guildId;
    const warnings = sourceGuildId === input.currentGuildId
        ? []
        : [getNotificationImportMessage(locale, "setupTemplates.importCopy.crossGuild", {
            sourceGuildId,
            currentGuildId: input.currentGuildId,
        })];

    const seenKeys = new Set(input.currentRecords.map((record) => getImportKey(record)).filter((key): key is string => key !== null));
    const ready: NotificationSetupImportItem[] = [];
    const skipped: NotificationSetupImportSkippedItem[] = [];

    for (const rawRecord of input.exportPayload.records) {
        const normalized = normalizeImportRecord(rawRecord, locale);
        if (!normalized.record) {
            skipped.push({
                key: `invalid:${skipped.length}`,
                record: fallbackRecord(rawRecord, locale),
                reason: "invalid",
                message: normalized.message,
            });
            continue;
        }

        const key = getImportKey(normalized.record);
        if (!key) {
            skipped.push({
                key: `invalid:${skipped.length}`,
                record: normalized.record,
                reason: "invalid",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.missingRoute"),
            });
            continue;
        }
        if (!supportedProviders.has(normalized.record.provider)) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "unsupported",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.unsupportedRestore", {
                    provider: normalized.record.provider,
                }),
            });
            continue;
        }
        if (normalized.record.provider === "YouTube" && !youtubeChannelIdPattern.test(getRecordIdentity(normalized.record))) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.youtubeChannelId"),
            });
            continue;
        }
        if (normalized.record.provider === "Anime" && getPositiveIntegerIdentity(normalized.record) === null) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.animeId"),
            });
            continue;
        }
        if (normalized.record.provider === "Steam News" && getPositiveIntegerIdentity(normalized.record) === null) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.steamAppId"),
            });
            continue;
        }
        if (normalized.record.provider === "Birthdays" && !normalized.record.birthday) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.birthdayValues"),
            });
            continue;
        }
        if (seenKeys.has(key)) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "duplicate",
                message: getNotificationImportMessage(locale, "setupTemplates.importCopy.duplicateRoute"),
            });
            continue;
        }

        seenKeys.add(key);
        ready.push({ key, record: normalized.record });
    }

    return {
        sourceGuildId,
        currentGuildId: input.currentGuildId,
        warnings,
        ready,
        skipped,
        totals: {
            records: input.exportPayload.records.length,
            ready: ready.length,
            duplicate: countSkipped(skipped, "duplicate"),
            unsupported: countSkipped(skipped, "unsupported"),
            invalid: countSkipped(skipped, "invalid"),
        },
    };
}

export function buildNotificationSetupImportCreatePayload(
    guildId: string,
    record: NotificationSetupExportRecord,
    locale: DashboardLocale = "en",
): NotificationSetupImportCreatePayload {
    const source = getRecordIdentity(record);
    const timing = buildTimingPayload(record);

    if (record.provider === "Twitch") {
        return {
            provider: "Twitch",
            payload: {
                twitchUsername: source,
                discordChannelId: record.channelId,
                guildId,
                ...timing,
            },
        };
    }
    if (record.provider === "YouTube") {
        return {
            provider: "YouTube",
            payload: {
                youtubeChannelId: source,
                discordChannelId: record.channelId,
                guildId,
                ...timing,
            },
        };
    }
    if (record.provider === "TikTok") {
        return {
            provider: "TikTok",
            payload: {
                tiktokUsername: source,
                discordChannelId: record.channelId,
                guildId,
                ...timing,
            },
        };
    }
    if (record.provider === "Bluesky") {
        return {
            provider: "Bluesky",
            payload: {
                blueskyHandle: source.replace(/^@/, ""),
                discordChannelId: record.channelId,
                guildId,
                ...timing,
            },
        };
    }
    if (record.provider === "Patch Notes") {
        return {
            provider: "Patch Notes",
            payload: {
                game: source,
                channelId: record.channelId,
                guildId,
                paused: Boolean(record.paused),
            },
        };
    }
    if (record.provider === "Steam News") {
        const steamAppId = getPositiveIntegerIdentity(record);
        if (steamAppId === null) {
            throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.steamAppId"));
        }

        return {
            provider: "Steam News",
            payload: {
                steamAppId,
                appName: record.source === String(steamAppId) ? undefined : record.source,
                discordChannelId: record.channelId,
                guildId,
                ...timing,
            },
        };
    }
    if (record.provider === "Anime") {
        const anilistId = getPositiveIntegerIdentity(record);
        if (anilistId === null) {
            throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.animeId"));
        }

        return {
            provider: "Anime",
            payload: {
                anilistId,
                channelId: record.channelId,
                guildId,
                reminderMinutes: normalizeReminderMinutes(record.reminderMinutes ?? record.cooldownMinutes),
            },
        };
    }
    if (record.provider === "Birthdays") {
        if (!record.birthday) {
            throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.birthdayValues"));
        }

        return {
            provider: "Birthdays",
            payload: {
                userId: getRecordIdentity(record),
                channelId: record.channelId,
                guildId,
                day: record.birthday.day,
                month: record.birthday.month,
                ...(record.birthday.year ? { year: record.birthday.year } : {}),
            },
        };
    }

    throw new Error(getNotificationImportMessage(locale, "setupTemplates.importCopy.unsupportedProvider", {
        provider: record.provider,
    }));
}

function normalizeImportRecord(value: unknown, locale: DashboardLocale): { record: NotificationSetupExportRecord | null; message: string } {
    if (!isRecord(value)) {
        return { record: null, message: getNotificationImportMessage(locale, "setupTemplates.importCopy.recordObject") };
    }

    const provider = normalizeString(value.provider);
    const source = normalizeString(value.source);
    const sourceId = normalizeString(value.sourceId);
    const channelId = normalizeString(value.channelId);
    if (!provider || !source || !channelId) {
        return { record: null, message: getNotificationImportMessage(locale, "setupTemplates.importCopy.missingRoute") };
    }

    const cooldownMinutes = normalizeCooldown(value.cooldownMinutes);
    if (cooldownMinutes.invalid) {
        return { record: null, message: getNotificationImportMessage(locale, "setupTemplates.importCopy.cooldownInvalid") };
    }

    const quietHoursStart = normalizeTime(value.quietHoursStart);
    const quietHoursEnd = normalizeTime(value.quietHoursEnd);
    if (quietHoursStart.invalid || quietHoursEnd.invalid) {
        return { record: null, message: getNotificationImportMessage(locale, "setupTemplates.importCopy.quietHoursInvalid") };
    }
    const reminderMinutes = normalizeReminder(value.reminderMinutes);
    if (reminderMinutes.invalid) {
        return { record: null, message: getNotificationImportMessage(locale, "setupTemplates.importCopy.reminderInvalid") };
    }
    const birthday = normalizeBirthday(value.birthday);
    if (birthday.invalid) {
        return { record: null, message: getNotificationImportMessage(locale, "setupTemplates.importCopy.birthdayInvalid") };
    }

    return {
        record: {
            provider,
            source,
            sourceId,
            channelId,
            paused: typeof value.paused === "boolean" ? value.paused : null,
            customMessage: normalizeString(value.customMessage),
            cooldownMinutes: cooldownMinutes.value,
            reminderMinutes: reminderMinutes.value,
            quietHoursStart: quietHoursStart.value,
            quietHoursEnd: quietHoursEnd.value,
            birthday: birthday.value,
        },
        message: "",
    };
}

function fallbackRecord(value: unknown, locale: DashboardLocale): NotificationSetupExportRecord {
    const unknown = getNotificationImportMessage(locale, "setupTemplates.importCopy.unknown");
    if (!isRecord(value)) {
        return { provider: unknown, source: unknown, channelId: unknown };
    }
    return {
        provider: normalizeString(value.provider) ?? unknown,
        source: normalizeString(value.source) ?? unknown,
        sourceId: normalizeString(value.sourceId),
        channelId: normalizeString(value.channelId) ?? unknown,
        birthday: normalizeBirthday(value.birthday).value,
    };
}

function buildTimingPayload(record: NotificationSetupExportRecord): Record<string, unknown> {
    return {
        customMessage: record.customMessage ?? undefined,
        cooldownMinutes: record.cooldownMinutes ?? null,
        quietHoursStart: record.quietHoursStart ?? null,
        quietHoursEnd: record.quietHoursEnd ?? null,
        paused: Boolean(record.paused),
    };
}

function getImportKey(record: NotificationSetupExportRecord): string | null {
    const provider = normalizeString(record.provider);
    const source = normalizeString(getRecordIdentity(record));
    const channelId = normalizeString(record.channelId);
    if (!provider || !source || !channelId) return null;
    if (provider === "Birthdays") {
        return `${provider.toLowerCase()}:${source.toLowerCase()}`;
    }
    return `${provider.toLowerCase()}:${source.toLowerCase()}:${channelId}`;
}

function getRecordIdentity(record: NotificationSetupExportRecord): string {
    return normalizeString(record.sourceId) ?? record.source;
}

function getPositiveIntegerIdentity(record: NotificationSetupExportRecord): number | null {
    const parsed = Number(getRecordIdentity(record));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function countSkipped(skipped: NotificationSetupImportSkippedItem[], reason: NotificationSetupImportSkipReason): number {
    return skipped.filter((item) => item.reason === reason).length;
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeCooldown(value: unknown): { value: number | null; invalid: boolean } {
    if (value === undefined || value === null) return { value: null, invalid: false };
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        return { value: null, invalid: true };
    }
    return { value, invalid: false };
}

function normalizeReminder(value: unknown): { value: number | null; invalid: boolean } {
    if (value === undefined || value === null) return { value: null, invalid: false };
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1440) {
        return { value: null, invalid: true };
    }
    return { value, invalid: false };
}

function normalizeReminderMinutes(value: unknown): number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1440 ? value : 30;
}

function normalizeTime(value: unknown): { value: string | null; invalid: boolean } {
    if (value === undefined || value === null || value === "") return { value: null, invalid: false };
    if (typeof value !== "string" || !hhmmPattern.test(value)) {
        return { value: null, invalid: true };
    }
    return { value, invalid: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBirthday(value: unknown): { value: NotificationSetupExportRecord["birthday"]; invalid: boolean } {
    if (value === undefined || value === null) return { value: null, invalid: false };
    if (!isRecord(value)) return { value: null, invalid: true };

    const day = normalizeBirthdayNumber(value.day);
    const month = normalizeBirthdayNumber(value.month);
    const year = value.year === undefined || value.year === null ? null : normalizeBirthdayNumber(value.year);
    if (day === null || month === null || (value.year !== undefined && value.year !== null && year === null)) {
        return { value: null, invalid: true };
    }
    if (!isValidBirthdayDate(day, month, year ?? undefined)) {
        return { value: null, invalid: true };
    }

    return {
        value: {
            day,
            month,
            year,
        },
        invalid: false,
    };
}

function normalizeBirthdayNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    return value;
}

function isValidBirthdayDate(day: number, month: number, year?: number): boolean {
    if (year !== undefined && (year < 1900 || year > 9999)) return false;
    const testYear = year ?? 2000;
    const date = new Date(testYear, month - 1, day);
    return date.getFullYear() === testYear
        && date.getMonth() === month - 1
        && date.getDate() === day;
}
