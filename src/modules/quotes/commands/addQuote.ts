import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {v4 as uuidv4} from 'uuid';

export const data = new SlashCommandBuilder()
    .setName('addquote')
    .setDescription('Add a quote')
    .addStringOption(option =>
        option.setName('quote')
            .setDescription('The quote text')
            .setRequired(true)
    )
    .addUserOption(option =>
        option.setName('author')
            .setDescription('User who said the quote')
            .setRequired(true)
    );

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    const quoteText = interaction.options.getString('quote', true);
    const author = interaction.options.getUser('author', true);
    const submitter = interaction.user;
    const guildId = interaction.guildId!;

    await configManager.quoteManager.addQuote({
        id: uuidv4(),
        guildId,
        quote: quoteText,
        authorId: author.id,
        submitterId: submitter.id,
        timestamp: Date.now(),
    });

    await interaction.reply(`Quote added for ${author.tag}: "${quoteText}"`);
}