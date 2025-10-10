import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';

const data = new SlashCommandBuilder()
    .setName('quotes')
    .setDescription('Get all quotes for a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to get quotes for')
            .setRequired(true)
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

    const formatted = quotes.map(quote => {
        const tsRaw = (quote as { timestamp: number | string | null | undefined }).timestamp;
        const ts = typeof tsRaw === 'string' ? Number(tsRaw) : tsRaw ?? 0;
        const dateStr = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString() : 'Unknown date';
        return `> ${quote.quote}\n— <@${quote.authorId}> (${dateStr})`;
    }).join('\n\n');
    await interaction.reply(`Quotes for ${user.tag}:\n${formatted}`);
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};