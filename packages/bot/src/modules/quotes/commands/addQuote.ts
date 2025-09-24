import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {configManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';
import {v4 as uuidv4} from 'uuid';

const data = new SlashCommandBuilder()
    .setName('add-quote')
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

/**
 * Executes the add-quote command, adding a quote for a specified user.
 * Replies with a confirmation message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const quoteText = interaction.options.getString('quote', true);
    const author = interaction.options.getUser('author', true);
    const submitter = interaction.user;
    const guildId = interaction.guildId!;

    await configManager.quoteManager.add({
        id: uuidv4(),
        guildId,
        quote: quoteText,
        authorId: author.id,
        submitterId: submitter.id,
        timestamp: Date.now(),
    });

    await interaction.reply(`Quote added for ${author.tag}: "${quoteText}"`);
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};