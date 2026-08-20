import {SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {isValidTimezone, getTimezoneSuggestions} from '../../../utils/timezoneUtils.js';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import { getTestOnly } from '../../../core/commandBuilder.js';
import { setTimezone as META } from '../commands.manifest.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { getReminderCopy } from '../copy/reminderCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option.setName('timezone')
            .setNameLocalization('nl', 'tijdzone')
            .setDescription('Your IANA timezone (e.g., Europe/Berlin or GMT+2)')
            .setDescriptionLocalization('nl', 'Je IANA-tijdzone (bijv. Europe/Berlin of GMT+2)')
            .setRequired(true)
            .setAutocomplete(true)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const copy = getReminderCopy(await resolveInteractionOutputLocale(interaction));
    const timezone = interaction.options.getString('timezone', true);
    const userId = interaction.user.id;

    if (!isValidTimezone(timezone)) {
        await interaction.reply(copy.invalidTimezone);
        return;
    }

    await getConfigManager().userManager.setTimezone({discordId: userId, timezone: timezone});
    await interaction.reply(copy.timezoneSet(timezone));
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const suggestions = getTimezoneSuggestions(focusedValue);
    await interaction.respond(
        suggestions.map((tz: string) => ({name: tz, value: tz})).slice(0, 25)
    );
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete, testOnly};
