import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { isReminderPaused, resolveReminderByInput, type ReminderLike } from './reminderFormat.js';

export async function listRemindersForUser(userId: string): Promise<ReminderLike[]> {
    return getConfigManager().reminderManager.getRemindersByUser(userId) as unknown as ReminderLike[];
}

export async function resolvePendingReminderForUser(userId: string, input: string, nowMs = Date.now()): Promise<ReminderLike | null> {
    const pending = await listPendingRemindersForUser(userId, nowMs);
    return resolveReminderByInput(pending, input);
}

export async function resolveReminderForUser(userId: string, input: string): Promise<ReminderLike | null> {
    const reminders = (await listRemindersForUser(userId)).sort(sortReminderByTimestamp);
    return resolveReminderByInput(reminders, input);
}

export function sortReminderByTimestamp(left: ReminderLike, right: ReminderLike): number {
    return Number(left.timestamp) - Number(right.timestamp);
}

export function isVisibleReminder(reminder: ReminderLike, nowMs = Date.now()): boolean {
    return isReminderPaused(reminder) || Number(reminder.timestamp) > nowMs;
}

export async function listPendingRemindersForUser(userId: string, nowMs = Date.now()): Promise<ReminderLike[]> {
    const rows = await listRemindersForUser(userId);
    return rows
        .filter((row) => !isReminderPaused(row) && Number(row.timestamp) > nowMs)
        .sort(sortReminderByTimestamp);
}

export async function listVisibleRemindersForUser(userId: string, nowMs = Date.now()): Promise<ReminderLike[]> {
    const rows = await getConfigManager().reminderManager.getRemindersByUser(userId) as unknown as ReminderLike[];
    return rows
        .filter((row) => isVisibleReminder(row, nowMs))
        .sort(sortReminderByTimestamp);
}
