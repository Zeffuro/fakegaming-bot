import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {MessageFlags, UserContextMenuCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createUserContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {showQuotes as META} from '../commands.manifest.js';
import {formatQuotesForUser, type QuoteLike} from '../shared/formatQuotes.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

const data = createUserContextCommand(META);

async function execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: resolveLocaleValue(locale, { en: 'Quote lookup only works in a server.', nl: 'Citaten opzoeken werkt alleen op een server.' }), flags: MessageFlags.Ephemeral});
        return;
    }

    const targetUser = interaction.targetUser;
    const quotes = await getConfigManager().quoteManager.getQuotesByAuthor(guildId, targetUser.id) as unknown as QuoteLike[];
    await interaction.reply({
        content: formatQuotesForUser(targetUser.tag, quotes, locale),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
