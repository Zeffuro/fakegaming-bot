import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';

export const data = new SlashCommandBuilder()
    .setName('quotes')
    .setDescription('Get all quotes for a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to get quotes for')
            .setRequired(true)
    );

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const quotes = configManager.quoteManager.getQuotesByAuthor(guildId, user.id);

    if (!quotes || quotes.length === 0) {
        await interaction.reply(`No quotes found for ${user.tag}.`);
        return;
    }

    const formatted = quotes.map(quote => `> ${quote.quote}\n— <@${quote.authorId}> (${new Date(quote.timestamp).toLocaleString()})`).join('\n\n');
    await interaction.reply(`Quotes for ${user.tag}:\n${formatted}`);
}