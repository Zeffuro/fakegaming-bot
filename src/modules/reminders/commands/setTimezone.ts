import {SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {isValidTimezone, getTimezoneSuggestions} from '../../../utils/timezoneUtils.js';

export const data = new SlashCommandBuilder()
    .setName('set-timezone')
    .setDescription('Set your timezone')
    .addStringOption(option =>
        option.setName('timezone')
            .setDescription('Your IANA timezone (e.g., Europe/Berlin or GMT+2)')
            .setRequired(true)
            .setAutocomplete(true)
    );

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    const timezone = interaction.options.getString('timezone', true);
    const userId = interaction.user.id;

    if (!isValidTimezone(timezone)) {
        await interaction.reply('Invalid timezone. Please use a valid IANA timezone (e.g., Europe/Berlin) or GMT offset.');
        return;
    }

    await configManager.userManager.setTimezone({discordId: userId, timezone: timezone});
    await interaction.reply(`Timezone set to \`${timezone}\`.`);
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const suggestions = getTimezoneSuggestions(focusedValue);
    await interaction.respond(
        suggestions.map((tz: string) => ({name: tz, value: tz})).slice(0, 25)
    );
}