import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';

export const data = new SlashCommandBuilder()
    .setName('searchquote')
    .setDescription('Search quotes by text')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('Text to search for')
            .setRequired(true)
    );

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString('text', true);
    const guildId = interaction.guildId!;
    const quotes = configManager.quoteManager.searchQuotes(guildId, text);

    if (!quotes || quotes.length === 0) {
        await interaction.reply('No quotes found matching your search.');
        return;
    }

    const formatted = quotes.map(quote => `> ${quote.quote}\n— <@${quote.authorId}> (${new Date(quote.timestamp).toLocaleString()})`).join('\n\n');
    await interaction.reply(`Quotes matching "${text}":\n${formatted}`);
}