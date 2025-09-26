import {SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {isValidTimezone, getTimezoneSuggestions} from '../../../utils/timezoneUtils.js';

const data = new SlashCommandBuilder()
    .setName('set-timezone')
    .setDescription('Set your timezone')
    .addStringOption(option =>
        option.setName('timezone')
            .setDescription('Your IANA timezone (e.g., Europe/Berlin or GMT+2)')
            .setRequired(true)
            .setAutocomplete(true)
    );

/**
 * Executes the set-timezone command, setting the user's timezone in the config manager.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const timezone = interaction.options.getString('timezone', true);
    const userId = interaction.user.id;

    if (!isValidTimezone(timezone)) {
        await interaction.reply('Invalid timezone. Please use a valid IANA timezone (e.g., Europe/Berlin) or GMT offset.');
        return;
    }

    await getConfigManager().userManager.setTimezone({discordId: userId, timezone: timezone});
    await interaction.reply(`Timezone set to \`${timezone}\`.`);
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const suggestions = getTimezoneSuggestions(focusedValue);
    await interaction.respond(
        suggestions.map((tz: string) => ({name: tz, value: tz})).slice(0, 25)
    );
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};