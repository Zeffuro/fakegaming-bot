import {Client, TextChannel} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';

/**
 * Checks all birthdays and announces them in the configured Discord channels if today matches.
 */
export async function checkAndAnnounceBirthdays(client: Client) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // months are 0-indexed

    const birthdays = await getConfigManager().birthdayManager.getAllPlain();

    for (const birthday of birthdays) {
        if (birthday.day === day && birthday.month === month) {
            try {
                const channel = await client.channels.fetch(birthday.channelId);
                if (channel && channel.isTextBased()) {
                    const ageText = birthday.year ? ` (turning ${today.getFullYear() - birthday.year})` : "";
                    await (channel as TextChannel).send(
                        `🎉 Happy birthday <@${birthday.userId}>${ageText}!`
                    );
                }
            } catch (err) {
                console.error(`Failed to send birthday message for user ${birthday.userId}:`, err);
            }
        }
    }
}