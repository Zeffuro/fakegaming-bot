import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {deleteQuote as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

interface QuoteRow {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
}

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option
            .setName('id')
            .setNameLocalization('nl', 'id')
            .setDescription('Quote ID or short ID')
            .setDescriptionLocalization('nl', 'Citaat-ID of verkort ID')
            .setRequired(true)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const input = interaction.options.getString('id', true).trim().toLowerCase();
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(interaction.guildId!) as unknown as QuoteRow[];
    const quote = quotes.find(row => row.id.toLowerCase() === input || row.id.toLowerCase().startsWith(input));

    if (!quote) {
        await interaction.reply({content: resolveLocaleValue(locale, { en: 'Quote not found in this server.', nl: 'Citaat niet gevonden op deze server.' }), flags: MessageFlags.Ephemeral});
        return;
    }

    if (quote.authorId !== interaction.user.id && quote.submitterId !== interaction.user.id) {
        await interaction.reply({content: resolveLocaleValue(locale, { en: 'You can only delete quotes you authored or added.', nl: 'Je kunt alleen citaten verwijderen die je uitsprak of toevoegde.' }), flags: MessageFlags.Ephemeral});
        return;
    }

    await getConfigManager().quoteManager.removeByPk(quote.id);
    await interaction.reply({content: resolveLocaleValue(locale, { en: `Deleted quote: "${quote.quote}"`, nl: `Citaat verwijderd: "${quote.quote}"` }), flags: MessageFlags.Ephemeral});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
