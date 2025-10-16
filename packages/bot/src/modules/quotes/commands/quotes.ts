import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import { formatQuotesBlock } from '../shared/formatQuotes.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { quotes as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addUserOption(option => option.setName('user').setDescription('User to get quotes for').setRequired(true))
);

/**
 * Executes the quotes command, replying with all quotes for a specified user.
 * Replies with a formatted list or a message if none are found.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor(guildId, user.id);

    if (!quotes || quotes.length === 0) {
        await interaction.reply(`No quotes found for ${user.tag}.`);
        return;
    }

    const formatted = formatQuotesBlock(quotes as Array<{ quote: string; authorId: string; timestamp?: number | string | null | undefined }>);
    await interaction.reply(`Quotes for ${user.tag}:\n${formatted}`);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};