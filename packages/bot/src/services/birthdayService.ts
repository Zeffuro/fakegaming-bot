import {Client, TextChannel} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';

/**
 * Checks all birthdays and announces them in the configured Discord channels if today matches.
 */
export async function checkAndAnnounceBirthdays(client: Client, today: Date = new Date()) {
    const day = today.getDate();
    const month = today.getMonth() + 1; // months are 0-indexed

    const birthdays = await getConfigManager().birthdayManager.getAllPlain();

    for (const birthday of birthdays) {
        let isBirthday = birthday.day === day && birthday.month === month;
        // Special case: announce Feb 29 birthdays on Feb 29 (leap years)
        // and on Feb 28 in non-leap years
        if (!isBirthday && birthday.day === 29 && birthday.month === 2) {
            const isLeapYear = (year: number) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
            if (month === 2 && day === 28 && !isLeapYear(today.getFullYear())) {
                isBirthday = true;
            }
        }
        if (isBirthday) {
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