import type { NotificationSetupExport, NotificationSetupExportRecord } from "@/lib/notificationSetupExport";
import { getDashboardLocaleValue, type DashboardLocale, type DashboardLocaleValues } from "@/lib/i18n/localeStore";

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

interface NotificationImportCopy {
    invalidJson: string;
    invalidObject: string;
    unsupportedVersion: string;
    missingGuildId: string;
    missingRecords: string;
    crossGuild: (sourceGuildId: string, currentGuildId: string) => string;
    missingRoute: string;
    unsupportedRestore: (provider: string) => string;
    youtubeChannelId: string;
    animeId: string;
    steamAppId: string;
    birthdayValues: string;
    duplicateRoute: string;
    unsupportedProvider: (provider: string) => string;
    recordObject: string;
    cooldownInvalid: string;
    quietHoursInvalid: string;
    reminderInvalid: string;
    birthdayInvalid: string;
    unknown: string;
}

const notificationImportCopy = {
    en: {
        invalidJson: "Import file is not valid JSON.",
        invalidObject: "Import file must contain a notification setup object.",
        unsupportedVersion: "Only notification setup export version 1 is supported.",
        missingGuildId: "Import file is missing a source guild ID.",
        missingRecords: "Import file is missing notification records.",
        crossGuild: (sourceGuildId, currentGuildId) => `This export came from guild ${sourceGuildId}; imports will be created in guild ${currentGuildId}.`,
        missingRoute: "Record is missing a provider, source, or Discord channel.",
        unsupportedRestore: (provider) => `${provider} import is not supported by the dashboard restore flow yet.`,
        youtubeChannelId: "YouTube imports require a channel ID. Re-export from the updated dashboard or add the channel manually.",
        animeId: "Anime imports require an AniList ID. Re-export from the updated dashboard or add the subscription manually.",
        steamAppId: "Steam News imports require a numeric Steam App ID. Re-export from the updated dashboard or add the subscription manually.",
        birthdayValues: "Birthday imports require day and month values. Re-export from the updated dashboard or add the birthday manually.",
        duplicateRoute: "This provider/source/channel route already exists.",
        unsupportedProvider: (provider) => `${provider} import is not supported.`,
        recordObject: "Record must be an object.",
        cooldownInvalid: "Cooldown must be a non-negative whole number when provided.",
        quietHoursInvalid: "Quiet hours must use HH:mm format when provided.",
        reminderInvalid: "Reminder minutes must be a whole number between 0 and 1440 when provided.",
        birthdayInvalid: "Birthday details must include a valid day, month, and optional year.",
        unknown: "Unknown",
    },
    nl: {
        invalidJson: "Het importbestand bevat geen geldige JSON.",
        invalidObject: "Het importbestand moet een object met meldingsinstellingen bevatten.",
        unsupportedVersion: "Alleen versie 1 van de export van meldingsinstellingen wordt ondersteund.",
        missingGuildId: "In het importbestand ontbreekt de bronserver-ID.",
        missingRecords: "In het importbestand ontbreken meldingsrecords.",
        crossGuild: (sourceGuildId, currentGuildId) => `Deze export komt van server ${sourceGuildId}; imports worden aangemaakt op server ${currentGuildId}.`,
        missingRoute: "In het record ontbreekt een provider, bron of Discord-kanaal.",
        unsupportedRestore: (provider) => `Importeren van ${provider} wordt nog niet ondersteund door het herstelproces van het dashboard.`,
        youtubeChannelId: "Voor YouTube-imports is een kanaal-ID vereist. Exporteer opnieuw vanuit het bijgewerkte dashboard of voeg het kanaal handmatig toe.",
        animeId: "Voor anime-imports is een AniList-ID vereist. Exporteer opnieuw vanuit het bijgewerkte dashboard of voeg het abonnement handmatig toe.",
        steamAppId: "Voor Steam-nieuwsimports is een numerieke Steam-app-ID vereist. Exporteer opnieuw vanuit het bijgewerkte dashboard of voeg het abonnement handmatig toe.",
        birthdayValues: "Voor verjaardagsimports zijn een dag en maand vereist. Exporteer opnieuw vanuit het bijgewerkte dashboard of voeg de verjaardag handmatig toe.",
        duplicateRoute: "Deze route voor provider, bron en kanaal bestaat al.",
        unsupportedProvider: (provider) => `Importeren van ${provider} wordt niet ondersteund.`,
        recordObject: "Het record moet een object zijn.",
        cooldownInvalid: "De afkoelperiode moet, indien opgegeven, een niet-negatief geheel getal zijn.",
        quietHoursInvalid: "Stille uren moeten, indien opgegeven, de notatie HH:mm gebruiken.",
        reminderInvalid: "Herinneringsminuten moeten, indien opgegeven, een geheel getal tussen 0 en 1440 zijn.",
        birthdayInvalid: "Verjaardagsgegevens moeten een geldige dag, maand en optioneel jaar bevatten.",
        unknown: "Onbekend",
    },
} satisfies DashboardLocaleValues<NotificationImportCopy>;

export function parseNotificationSetupImportJson(text: string, locale: DashboardLocale = "en"): NotificationSetupExport {
    const copy = getDashboardLocaleValue(locale, notificationImportCopy);
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(copy.invalidJson);
    }

    if (!isRecord(parsed)) {
        throw new Error(copy.invalidObject);
    }
    if (parsed.version !== 1) {
        throw new Error(copy.unsupportedVersion);
    }
    if (typeof parsed.guildId !== "string" || parsed.guildId.trim().length === 0) {
        throw new Error(copy.missingGuildId);
    }
    if (!Array.isArray(parsed.records)) {
        throw new Error(copy.missingRecords);
    }

    return parsed as unknown as NotificationSetupExport;
}

export function buildNotificationSetupImportPlan(input: {
    exportPayload: NotificationSetupExport;
    currentGuildId: string;
    currentRecords: NotificationSetupExportRecord[];
}, locale: DashboardLocale = "en"): NotificationSetupImportPlan {
    const copy = getDashboardLocaleValue(locale, notificationImportCopy);
    const sourceGuildId = input.exportPayload.guildId;
    const warnings = sourceGuildId === input.currentGuildId
        ? []
        : [copy.crossGuild(sourceGuildId, input.currentGuildId)];

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
                message: copy.missingRoute,
            });
            continue;
        }
        if (!supportedProviders.has(normalized.record.provider)) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "unsupported",
                message: copy.unsupportedRestore(normalized.record.provider),
            });
            continue;
        }
        if (normalized.record.provider === "YouTube" && !youtubeChannelIdPattern.test(getRecordIdentity(normalized.record))) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: copy.youtubeChannelId,
            });
            continue;
        }
        if (normalized.record.provider === "Anime" && getPositiveIntegerIdentity(normalized.record) === null) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: copy.animeId,
            });
            continue;
        }
        if (normalized.record.provider === "Steam News" && getPositiveIntegerIdentity(normalized.record) === null) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: copy.steamAppId,
            });
            continue;
        }
        if (normalized.record.provider === "Birthdays" && !normalized.record.birthday) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "invalid",
                message: copy.birthdayValues,
            });
            continue;
        }
        if (seenKeys.has(key)) {
            skipped.push({
                key,
                record: normalized.record,
                reason: "duplicate",
                message: copy.duplicateRoute,
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
    const copy = getDashboardLocaleValue(locale, notificationImportCopy);
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
            throw new Error(copy.steamAppId);
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
            throw new Error(copy.animeId);
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
            throw new Error(copy.birthdayValues);
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

    throw new Error(copy.unsupportedProvider(record.provider));
}

function normalizeImportRecord(value: unknown, locale: DashboardLocale): { record: NotificationSetupExportRecord | null; message: string } {
    const copy = getDashboardLocaleValue(locale, notificationImportCopy);
    if (!isRecord(value)) {
        return { record: null, message: copy.recordObject };
    }

    const provider = normalizeString(value.provider);
    const source = normalizeString(value.source);
    const sourceId = normalizeString(value.sourceId);
    const channelId = normalizeString(value.channelId);
    if (!provider || !source || !channelId) {
        return { record: null, message: copy.missingRoute };
    }

    const cooldownMinutes = normalizeCooldown(value.cooldownMinutes);
    if (cooldownMinutes.invalid) {
        return { record: null, message: copy.cooldownInvalid };
    }

    const quietHoursStart = normalizeTime(value.quietHoursStart);
    const quietHoursEnd = normalizeTime(value.quietHoursEnd);
    if (quietHoursStart.invalid || quietHoursEnd.invalid) {
        return { record: null, message: copy.quietHoursInvalid };
    }
    const reminderMinutes = normalizeReminder(value.reminderMinutes);
    if (reminderMinutes.invalid) {
        return { record: null, message: copy.reminderInvalid };
    }
    const birthday = normalizeBirthday(value.birthday);
    if (birthday.invalid) {
        return { record: null, message: copy.birthdayInvalid };
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
    const unknown = getDashboardLocaleValue(locale, notificationImportCopy).unknown;
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
