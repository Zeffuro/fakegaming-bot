import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {deleteQuote as META} from '../commands.manifest.js';

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
            .setDescription('Quote ID or short ID')
            .setRequired(true)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const input = interaction.options.getString('id', true).trim().toLowerCase();
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(interaction.guildId!) as unknown as QuoteRow[];
    const quote = quotes.find(row => row.id.toLowerCase() === input || row.id.toLowerCase().startsWith(input));

    if (!quote) {
        await interaction.reply({content: 'Quote not found in this server.', flags: MessageFlags.Ephemeral});
        return;
    }

    if (quote.authorId !== interaction.user.id && quote.submitterId !== interaction.user.id) {
        await interaction.reply({content: 'You can only delete quotes you authored or added.', flags: MessageFlags.Ephemeral});
        return;
    }

    await getConfigManager().quoteManager.removeByPk(quote.id);
    await interaction.reply({content: `Deleted quote: "${quote.quote}"`, flags: MessageFlags.Ephemeral});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
