import {Client, TextChannel} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';

export async function checkAndAnnounceBirthdays(client: Client, today: Date = new Date()) {
    const birthdays = await getConfigManager().birthdayManager.getAllPlain();
    const currentYear = today.getFullYear();

    for (const b of birthdays) {
        if (!getConfigManager().birthdayManager.isBirthdayToday(b, today)) continue;

        try {
            const channel = await client.channels.fetch(b.channelId);
            if (channel?.isTextBased()) {
                const ageText = b.year ? ` (turning ${currentYear - b.year})` : "";
                await (channel as TextChannel).send(`🎉 Happy birthday <@${b.userId}>${ageText}!`);
            }
        } catch (err) {
            console.error(`Failed to send birthday message for user ${b.userId}:`, err);
        }
    }
}
