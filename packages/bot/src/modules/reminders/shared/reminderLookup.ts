import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { resolveReminderByInput, type ReminderLike } from './reminderFormat.js';

export async function resolvePendingReminderForUser(userId: string, input: string, nowMs = Date.now()): Promise<ReminderLike | null> {
    const rows = await getConfigManager().reminderManager.getRemindersByUser(userId) as unknown as ReminderLike[];
    const pending = rows
        .filter((row) => Number(row.timestamp) > nowMs)
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    return resolveReminderByInput(pending, input);
}
