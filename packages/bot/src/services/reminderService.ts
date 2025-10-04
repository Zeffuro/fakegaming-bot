import {Client, EmbedBuilder} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {formatElapsed, parseTimespan} from '../utils/timeUtils.js';

export async function checkAndSendReminders(client: Client) {
    const allReminders = await getConfigManager().reminderManager.getAllPlain();
    const now = Date.now();
    const dueReminders = allReminders.filter(reminder => reminder.timestamp <= now);

    for (const reminder of dueReminders) {
        try {
            const user = await client.users.fetch(reminder.userId);
            const timespanMs = parseTimespan(reminder.timespan ?? "") ?? 0;
            const elapsed = formatElapsed(now - (reminder.timestamp - timespanMs));
            const embed = new EmbedBuilder()
                .setTitle('⏰ Reminder')
                .setDescription(reminder.message)
                .setThumbnail('https://cdn.discordapp.com/emojis/759677044723253278.png') // clock emoji image
                .setFooter({text: `Reminder from ${elapsed}`});
            await user.send({embeds: [embed]});
        } catch (err) {
            console.error(`Failed to send reminder to user ${reminder.userId}:`, err);
        }
        try {
            await getConfigManager().reminderManager.removeReminder({id: reminder.id});
        } catch (err) {
            console.error(`Failed to remove reminder ${reminder.id}:`, err);
        }
    }
}