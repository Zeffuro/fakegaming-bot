import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

export interface ProductivityNotification {
    content: string;
    task?: { id: string; version: number };
    noControls?: boolean;
}

export async function prepareProductivityNotification(reminder: { id: string; userId: string; message: string }): Promise<ProductivityNotification | null> {
    const cm = getConfigManager();
    if (reminder.id.startsWith('task:')) {
        const task = await cm.userTaskManager.forReminder(reminder.id, reminder.userId);
        return task ? { content: task.title, task: { id: task.id, version: task.version } } : null;
    }
    if (reminder.id.startsWith('session:')) {
        const content = await cm.userSessionManager.prepareNotification(reminder.id, reminder.userId);
        return content === null ? null : { content, noControls: true };
    }
    if (reminder.id.startsWith('countdown:')) {
        return await cm.userCountdownManager.forReminder(reminder.id, reminder.userId) ? { content: reminder.message, noControls: true } : null;
    }
    return { content: reminder.message };
}
