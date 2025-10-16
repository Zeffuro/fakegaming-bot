import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import { formatQuotesBlock } from '../shared/formatQuotes.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { searchQuote as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option => option.setName('text').setDescription('Text to search for').setRequired(true))
);

/**
 * Executes the search-quote command, searching for quotes by text.
 * Replies with matching quotes or a message if none are found.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString('text', true);
    const guildId = interaction.guildId!;
    const quotes = await getConfigManager().quoteManager.searchQuotes(guildId, text);

    if (!quotes || quotes.length === 0) {
        await interaction.reply('No quotes found matching your search.');
        return;
    }

    const formatted = formatQuotesBlock(quotes as Array<{ quote: string; authorId: string; timestamp?: number | string | null | undefined }>);
    await interaction.reply(`Quotes matching "${text}":\n${formatted}`);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};