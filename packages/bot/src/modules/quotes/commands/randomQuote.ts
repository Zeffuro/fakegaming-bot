import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';

const data = new SlashCommandBuilder()
    .setName('random-quote')
    .setDescription('Get a random quote from the server');

async function execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild({guildId});
    if (!quotes || quotes.length === 0) {
        await interaction.reply('No quotes found for this server.');
        return;
    }
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    const date = new Date(random.timestamp).toLocaleString();
    await interaction.reply(
        `> ${random.quote}\n— <@${random.authorId}> (${date})`
    );
}

const testOnly = false;

export default {data, execute, testOnly};

