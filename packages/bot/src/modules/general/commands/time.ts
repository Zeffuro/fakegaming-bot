import {SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {isValidTimezone, getTimezoneSuggestions} from '../../../utils/timezoneUtils.js';
import {time as META} from '../commands.manifest.js';

interface DateParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option
            .setName('time')
            .setDescription('now, 20:30, 2026-06-11 20:30, ISO time, or Unix timestamp')
            .setRequired(true)
    ).addStringOption(option =>
        option
            .setName('timezone')
            .setDescription('Timezone for wall-clock input. Defaults to your saved timezone or UTC')
            .setRequired(false)
            .setAutocomplete(true)
    )
);

function getZonedParts(date: Date, timezone: string): DateParts {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
    });
    const values = new Map(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return {
        year: Number(values.get('year')),
        month: Number(values.get('month')),
        day: Number(values.get('day')),
        hour: Number(values.get('hour')),
        minute: Number(values.get('minute')),
        second: Number(values.get('second')),
    };
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
    const parts = getZonedParts(date, timezone);
    const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return zonedAsUtc - date.getTime();
}

function partsEqual(a: DateParts, b: DateParts): boolean {
    return a.year === b.year
        && a.month === b.month
        && a.day === b.day
        && a.hour === b.hour
        && a.minute === b.minute
        && a.second === b.second;
}

function isValidDateParts(parts: DateParts): boolean {
    if (parts.month < 1 || parts.month > 12) return false;
    if (parts.day < 1 || parts.day > 31) return false;
    if (parts.hour < 0 || parts.hour > 23) return false;
    if (parts.minute < 0 || parts.minute > 59) return false;
    if (parts.second < 0 || parts.second > 59) return false;
    return true;
}

function zonedWallTimeToDate(parts: DateParts, timezone: string): Date | null {
    if (!isValidDateParts(parts)) return null;

    const wallMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    let utcMs = wallMs;
    for (let i = 0; i < 4; i++) {
        utcMs = wallMs - getTimezoneOffsetMs(new Date(utcMs), timezone);
    }

    const date = new Date(utcMs);
    return partsEqual(getZonedParts(date, timezone), parts) ? date : null;
}

function hasExplicitTimezone(input: string): boolean {
    return /(?:z|[+-]\d{2}:?\d{2})$/i.test(input.trim());
}

function parseUnixTimestamp(input: string): Date | null {
    if (!/^\d{10,13}$/.test(input)) return null;
    const value = Number(input);
    const ms = input.length <= 10 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseWallClockInput(input: string, timezone: string, now: Date): Date | null {
    const dateTimeMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/.exec(input);
    if (dateTimeMatch) {
        return zonedWallTimeToDate({
            year: Number(dateTimeMatch[1]),
            month: Number(dateTimeMatch[2]),
            day: Number(dateTimeMatch[3]),
            hour: dateTimeMatch[4] ? Number(dateTimeMatch[4]) : 0,
            minute: dateTimeMatch[5] ? Number(dateTimeMatch[5]) : 0,
            second: dateTimeMatch[6] ? Number(dateTimeMatch[6]) : 0,
        }, timezone);
    }

    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input);
    if (timeMatch) {
        const today = getZonedParts(now, timezone);
        return zonedWallTimeToDate({
            year: today.year,
            month: today.month,
            day: today.day,
            hour: Number(timeMatch[1]),
            minute: Number(timeMatch[2]),
            second: timeMatch[3] ? Number(timeMatch[3]) : 0,
        }, timezone);
    }

    return null;
}

export function parseTimeInput(input: string, timezone: string, now = new Date()): Date | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^now$/i.test(trimmed)) return now;

    const unix = parseUnixTimestamp(trimmed);
    if (unix) return unix;

    if (hasExplicitTimezone(trimmed)) {
        const parsedMs = Date.parse(trimmed);
        if (Number.isFinite(parsedMs)) return new Date(parsedMs);
    }

    return parseWallClockInput(trimmed, timezone, now);
}

function formatInTimezone(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: timezone,
    }).format(date);
}

function buildTimeReply(date: Date, input: string, timezone: string): string {
    const unixSeconds = Math.floor(date.getTime() / 1000);
    return [
        `Input: \`${input}\` in \`${timezone}\``,
        `Local time: **${formatInTimezone(date, timezone)}**`,
        '',
        `Long: <t:${unixSeconds}:F>`,
        `Short: <t:${unixSeconds}:f>`,
        `Time: <t:${unixSeconds}:t>`,
        `Relative: <t:${unixSeconds}:R>`,
        '',
        `Copy: \`<t:${unixSeconds}:F>\``,
        `Unix: \`${unixSeconds}\``,
    ].join('\n');
}

async function getDefaultTimezone(userId: string): Promise<string> {
    const user = await getConfigManager().userManager.getUser({discordId: userId}).catch(() => null);
    return user?.timezone || 'UTC';
}

async function execute(interaction: ChatInputCommandInteraction) {
    const input = interaction.options.getString('time', true);
    const timezone = interaction.options.getString('timezone') ?? await getDefaultTimezone(interaction.user.id);

    if (!isValidTimezone(timezone)) {
        await interaction.reply('Invalid timezone. Please use a valid IANA timezone (for example, Europe/Amsterdam) or GMT offset.');
        return;
    }

    const parsed = parseTimeInput(input, timezone);
    if (!parsed) {
        await interaction.reply('Invalid time. Try `now`, `20:30`, `2026-06-11 20:30`, an ISO timestamp, or a Unix timestamp.');
        return;
    }

    await interaction.reply(buildTimeReply(parsed, input, timezone));
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const suggestions = getTimezoneSuggestions(focusedValue);
    await interaction.respond(
        suggestions.map((timezone: string) => ({name: timezone, value: timezone})).slice(0, 25)
    );
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
