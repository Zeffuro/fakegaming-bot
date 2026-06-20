import {months} from '../../../constants/months.js';

export interface BirthdayRow {
    day: number;
    month: number;
    year?: number | null;
    userId: string;
    guildId: string;
    channelId?: string | null;
}

export interface UpcomingBirthday {
    row: BirthdayRow;
    date: Date;
}

export function nextBirthdayDate(row: BirthdayRow, now: Date): Date {
    const currentYear = now.getFullYear();
    const makeDate = (year: number) => new Date(year, row.month - 1, row.day, 12, 0, 0, 0);
    let next = makeDate(currentYear);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (next.getTime() < todayStart) {
        next = makeDate(currentYear + 1);
    }

    if (row.month === 2 && row.day === 29 && next.getMonth() !== 1) {
        next = new Date(next.getFullYear(), 1, 28, 12, 0, 0, 0);
    }

    return next;
}

export function getUpcomingBirthdays(
    rows: readonly BirthdayRow[],
    guildId: string | null,
    days: number,
    now = new Date(),
    limit = 15,
): UpcomingBirthday[] {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days + 1);
    return rows
        .filter(row => row.guildId === guildId)
        .map(row => ({row, date: nextBirthdayDate(row, now)}))
        .filter(item => item.date < cutoff)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, limit);
}

export function formatBirthdayLine(row: BirthdayRow, date: Date, now: Date): string {
    const unix = Math.floor(date.getTime() / 1000);
    const age = row.year ? date.getFullYear() - row.year : null;
    const ageText = age && age > 0 ? `, turns ${age}` : '';
    const today = date.toDateString() === now.toDateString();
    const relative = today ? 'today' : `<t:${unix}:R>`;
    return `<@${row.userId}> - ${row.day} ${months[row.month - 1].name}${ageText} (${relative})`;
}
