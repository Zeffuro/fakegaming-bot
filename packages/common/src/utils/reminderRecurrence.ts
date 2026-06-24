export type ReminderRecurrenceUnit = 'day' | 'week' | 'month';

export interface ReminderRecurrenceRule {
    unit: ReminderRecurrenceUnit;
    interval: number;
    timezone: string;
}

export interface NextRecurringReminderInput {
    rule: ReminderRecurrenceRule;
    previousTimestamp: number;
    afterTimestamp?: number;
}

const maxIntervalByUnit: Record<ReminderRecurrenceUnit, number> = {
    day: 365,
    week: 52,
    month: 24,
};
const dayMs = 24 * 60 * 60 * 1000;

export function parseReminderRecurrence(input: string, timezone: string): ReminderRecurrenceRule | null {
    const normalizedTimezone = normalizeTimezone(timezone);
    if (!normalizedTimezone) return null;

    const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'daily' || normalized === 'every day') {
        return { unit: 'day', interval: 1, timezone: normalizedTimezone };
    }
    if (normalized === 'weekly' || normalized === 'every week') {
        return { unit: 'week', interval: 1, timezone: normalizedTimezone };
    }
    if (normalized === 'monthly' || normalized === 'every month') {
        return { unit: 'month', interval: 1, timezone: normalizedTimezone };
    }

    const everyMatch = /^every (\d{1,3}) (days?|weeks?|months?)$/.exec(normalized);
    if (everyMatch) {
        return buildRule(Number(everyMatch[1]), normalizeUnit(everyMatch[2]), normalizedTimezone);
    }

    const compactMatch = /^(\d{1,3})\s*(d|day|days|w|week|weeks|mo|month|months)$/.exec(normalized);
    if (compactMatch) {
        return buildRule(Number(compactMatch[1]), normalizeUnit(compactMatch[2]), normalizedTimezone);
    }

    return null;
}

export function getNextRecurringReminderTimestamp(input: NextRecurringReminderInput): number | null {
    if (!isValidTimestamp(input.previousTimestamp)) return null;
    const afterTimestamp = input.afterTimestamp ?? input.previousTimestamp;
    if (!isValidTimestamp(afterTimestamp)) return null;

    let nextTimestamp = addRecurrenceInterval(input.previousTimestamp, input.rule);
    for (let guard = 0; guard < 1000 && nextTimestamp <= afterTimestamp; guard += 1) {
        nextTimestamp = addRecurrenceInterval(nextTimestamp, input.rule);
    }

    return nextTimestamp > afterTimestamp ? nextTimestamp : null;
}

export function formatReminderRecurrence(rule: ReminderRecurrenceRule): string {
    const unitLabel = rule.interval === 1 ? rule.unit : `${rule.unit}s`;
    return rule.interval === 1
        ? `Every ${rule.unit} (${rule.timezone})`
        : `Every ${rule.interval} ${unitLabel} (${rule.timezone})`;
}

function buildRule(interval: number, unit: ReminderRecurrenceUnit | null, timezone: string): ReminderRecurrenceRule | null {
    if (!unit || !Number.isInteger(interval) || interval < 1 || interval > maxIntervalByUnit[unit]) return null;
    return { unit, interval, timezone };
}

function normalizeUnit(value: string | undefined): ReminderRecurrenceUnit | null {
    if (!value) return null;
    if (value === 'd' || value === 'day' || value === 'days') return 'day';
    if (value === 'w' || value === 'week' || value === 'weeks') return 'week';
    if (value === 'mo' || value === 'month' || value === 'months') return 'month';
    return null;
}

function normalizeTimezone(timezone: string): string | null {
    const trimmed = timezone.trim();
    if (!trimmed) return null;

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(new Date(0));
        return trimmed;
    } catch {
        return null;
    }
}

function addRecurrenceInterval(timestamp: number, rule: ReminderRecurrenceRule): number {
    if (rule.unit === 'month') return addMonthsClamped(timestamp, rule.interval);
    const days = rule.unit === 'week' ? rule.interval * 7 : rule.interval;
    return timestamp + days * dayMs;
}

function addMonthsClamped(timestamp: number, months: number): number {
    const date = new Date(timestamp);
    const targetMonthIndex = date.getUTCMonth() + months;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const targetDay = Math.min(date.getUTCDate(), getDaysInUtcMonth(targetYear, targetMonth));

    return Date.UTC(
        targetYear,
        targetMonth,
        targetDay,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
    );
}

function getDaysInUtcMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function isValidTimestamp(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}
