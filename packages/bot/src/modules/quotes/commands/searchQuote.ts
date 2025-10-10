import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';

const data = new SlashCommandBuilder()
    .setName('search-quote')
    .setDescription('Search quotes by text')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('Text to search for')
            .setRequired(true)
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

    const formatted = quotes.map(quote => {
        const tsRaw = (quote as { timestamp: number | string | null | undefined }).timestamp;
        const ts = typeof tsRaw === 'string' ? Number(tsRaw) : tsRaw ?? 0;
        const dateStr = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString() : 'Unknown date';
        return `> ${quote.quote}\n— <@${quote.authorId}> (${dateStr})`;
    }).join('\n\n');
    await interaction.reply(`Quotes matching "${text}":\n${formatted}`);
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};