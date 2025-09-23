import {Client, TextChannel} from 'discord.js';
import {configManager} from '../config/configManagerSingleton.js';

/**
 * Checks all birthdays and announces them in the configured Discord channels if today matches.
 */
export async function checkAndAnnounceBirthdays(client: Client) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // months are 0-indexed

    const birthdays = await configManager.birthdayManager.getAll();

    for (const b of birthdays) {
        if (b.day === day && b.month === month) {
            try {
                const channel = await client.channels.fetch(b.channelId);
                if (channel && channel.isTextBased()) {
                    const ageText = b.year ? ` (turning ${today.getFullYear() - b.year})` : "";
                    await (channel as TextChannel).send(
                        `🎉 Happy birthday <@${b.userId}>${ageText}!`
                    );
                }
            } catch (err) {
                console.error(`Failed to send birthday message for user ${b.userId}:`, err);
            }
        }
    }
}