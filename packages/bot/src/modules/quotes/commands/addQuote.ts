import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {v4 as uuidv4} from 'uuid';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { addQuote as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('quote').setDescription('The quote text').setRequired(true))
        .addUserOption(option => option.setName('author').setDescription('User who said the quote').setRequired(true))
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

    const { created } = await getConfigManager().quoteManager.upsertQuote({
        id: uuidv4(),       // generate new id if new quote
        guildId,
        quote: quoteText,
        authorId: author.id,
        submitterId: submitter.id,
        timestamp: Date.now(),
    });

    await interaction.reply(
        created
            ? `Quote added for ${author.tag}: "${quoteText}"`
            : `Quote updated for ${author.tag}: "${quoteText}"`
    );
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};