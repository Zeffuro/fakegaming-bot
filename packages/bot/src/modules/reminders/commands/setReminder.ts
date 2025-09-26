import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {v4 as uuidv4} from 'uuid';
import {parseTimespan} from "../../../utils/timeUtils.js";

const data = new SlashCommandBuilder()
    .setName('set-reminder')
    .setDescription('Set a reminder')
    .addStringOption(option =>
        option.setName('timespan')
            .setDescription('When to remind (e.g., 1h, 30m)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('message')
            .setDescription('Reminder message')
            .setRequired(true)
    );

/**
 * Executes the set-reminder command, setting a reminder for the user after a specified timespan.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const timespan = interaction.options.getString('timespan', true);
    const message = interaction.options.getString('message', true);
    const userId = interaction.user.id;

    const ms = parseTimespan(timespan);
    if (ms === null || ms <= 0) {
        await interaction.reply('Invalid timespan format. Use e.g., 1h, 30m, 2h30m, 90s.');
        return;
    }

    const timestamp = Date.now() + ms;

    await getConfigManager().reminderManager.add({
        id: uuidv4(),
        userId,
        message,
        timespan,
        timestamp,
    });

    const discordTime = `<t:${Math.floor(timestamp / 1000)}:R>`;
    await interaction.reply({
        content: `⏰ I'll remind you in ${timespan}: "${message}" (at ${discordTime})`,
        flags: MessageFlags.Ephemeral
    });
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};