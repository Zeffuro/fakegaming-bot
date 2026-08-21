import { runtimeText } from '../../../core/runtimeCopy.js';
import {getOutputLocaleMetadata} from '@zeffuro/fakegaming-common';
import { ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { randomQuote as META } from '../commands.manifest.js';

const data = createSlashCommand(META);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const guildId = interaction.guildId!;
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(guildId);

    if (!quotes.length) {
        await interaction.reply(runtimeText(locale, "quotes", "noQuotesFoundForThisServer"));
        return;
    }

    const random = quotes[Math.floor(Math.random() * quotes.length)];
    const tsRaw = (random as { timestamp: number | string | null | undefined }).timestamp;
    const ts = typeof tsRaw === 'string' ? Number(tsRaw) : tsRaw ?? 0;
    const dateStr = Number.isFinite(ts) && ts > 0
        ? new Date(ts).toLocaleString(getOutputLocaleMetadata(locale).formatTag)
        : runtimeText(locale, "quotes", "unknownDate");
    await interaction.reply(`> ${random.quote}\n- <@${random.authorId}> (${dateStr})`);
}

const testOnly = getTestOnly(META);

export default { data, execute, testOnly };
