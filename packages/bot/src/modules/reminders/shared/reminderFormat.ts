export interface ReminderLike {
    id: string;
    message: string;
    timestamp: number | string;
}

export function shortReminderId(id: string): string {
    return id.slice(0, 8);
}

export function formatReminderLine(reminder: ReminderLike, index: number): string {
    const timestamp = typeof reminder.timestamp === 'string' ? Number(reminder.timestamp) : reminder.timestamp;
    const unix = Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
    const when = unix > 0 ? `<t:${unix}:R>` : 'unknown time';
    return `${index + 1}. \`${shortReminderId(reminder.id)}\` ${when} - ${reminder.message}`;
}

export function resolveReminderByInput<T extends ReminderLike>(reminders: T[], input: string): T | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    const index = Number(trimmed);
    if (Number.isInteger(index) && index >= 1 && index <= reminders.length) {
        return reminders[index - 1] ?? null;
    }

    return reminders.find(reminder => reminder.id.toLowerCase() === trimmed || reminder.id.toLowerCase().startsWith(trimmed)) ?? null;
}
