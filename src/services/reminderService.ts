import {Client, EmbedBuilder} from 'discord.js';
import {configManager} from '../config/configManagerSingleton.js';
import {formatElapsed, parseTimespan} from '../utils/timeUtils.js';

export async function checkAndSendReminders(client: Client) {
    const allReminders = configManager.reminderManager.getAllReminders();
    const now = Date.now();
    const dueReminders = allReminders.filter(reminder => reminder.timestamp <= now);

    for (const reminder of dueReminders) {
        try {
            const user = await client.users.fetch(reminder.userId);
            const elapsed = formatElapsed(now - (reminder.timestamp - parseTimespan(reminder.timespan)));
            const embed = new EmbedBuilder()
                .setTitle('⏰ Reminder')
                .setDescription(reminder.message)
                .setThumbnail('https://cdn.discordapp.com/emojis/759677044723253278.png') // clock emoji image
                .setFooter({text: `Reminder from ${elapsed}`});
            await user.send({embeds: [embed]});
        } catch (err) {
            console.error(`Failed to send reminder to user ${reminder.userId}:`, err);
        }
        await configManager.reminderManager.removeReminder(reminder.id);
    }
}