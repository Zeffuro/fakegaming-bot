import { Client, EmbedBuilder } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { formatElapsed, parseTimespan } from '../utils/timeUtils.js';

export async function checkAndSendReminders(client: Client) {
    const reminderManager = getConfigManager().reminderManager;

    // Get all reminders as plain objects
    const allReminders = await reminderManager.getAllPlain();
    const now = Date.now();

    // Only keep due reminders
    const dueReminders = allReminders.filter(r => r.timestamp <= now);

    for (const reminder of dueReminders) {
        // Send reminder
        try {
            const user = await client.users.fetch(reminder.userId);
            if (!user) {
                console.warn(`User ${reminder.userId} not found, skipping reminder.`);
                continue;
            }

            const timespanMs = parseTimespan(reminder.timespan ?? '') ?? 0;
            const elapsed = formatElapsed(now - (reminder.timestamp - timespanMs));

            const embed = new EmbedBuilder()
                .setTitle('⏰ Reminder')
                .setDescription(reminder.message)
                .setThumbnail('https://cdn.discordapp.com/emojis/759677044723253278.png')
                .setFooter({ text: `Reminder from ${elapsed}` });

            await user.send({ embeds: [embed] });
        } catch (err) {
            console.error(`Failed to send reminder to user ${reminder.userId}:`, err);
        }

        // Remove reminder after sending
        try {
            await reminderManager.removeReminder(reminder.id);
        } catch (err) {
            console.error(`Failed to remove reminder ${reminder.id}:`, err);
        }
    }
}