import { runtimeText } from '../../../core/runtimeCopy.js';
import {ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {quoteLeaderboard as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

interface QuoteRow {
    authorId: string;
}

const data = createSlashCommand(META);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(interaction.guildId!) as unknown as QuoteRow[];
    if (quotes.length === 0) {
        await interaction.reply(runtimeText(locale, "quotes", "noQuotesFoundForThisServer"));
        return;
    }

    const counts = new Map<string, number>();
    for (const quote of quotes) {
        counts.set(quote.authorId, (counts.get(quote.authorId) ?? 0) + 1);
    }

    const rows = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([authorId, count], index) => `${index + 1}. <@${authorId}> - ${count} ${runtimeText(locale, 'quotes', 'quoteCount', {count})}`);

    await interaction.reply(`${runtimeText(locale, "quotes", "quoteLeaderboard")}:\n${rows.join('\n')}`);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
