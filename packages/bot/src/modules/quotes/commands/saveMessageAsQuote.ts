import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {MessageContextMenuCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {v4 as uuidv4} from 'uuid';
import {createMessageContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {saveMessageAsQuote as META} from '../commands.manifest.js';
import {formatQuotePreview} from '../shared/formatQuotes.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

const data = createMessageContextCommand(META);

async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: resolveLocaleValue(locale, { en: 'Saving quotes only works in a server.', nl: 'Citaten opslaan werkt alleen op een server.' }), flags: MessageFlags.Ephemeral});
        return;
    }

    const targetMessage = interaction.targetMessage;
    const quoteText = targetMessage.content.trim();
    if (!quoteText) {
        await interaction.reply({
            content: resolveLocaleValue(locale, { en: 'That message has no text content to save as a quote.', nl: 'Dat bericht bevat geen tekst om als citaat op te slaan.' }),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const {created} = await getConfigManager().quoteManager.upsertQuote({
        id: uuidv4(),
        guildId,
        quote: quoteText,
        authorId: targetMessage.author.id,
        submitterId: interaction.user.id,
        timestamp: targetMessage.createdTimestamp || Date.now(),
    });

    const action = resolveLocaleValue(locale, { en: (created ? 'Saved' : 'Updated'), nl: (created ? 'Opgeslagen' : 'Bijgewerkt') });
    await interaction.reply({
        content: resolveLocaleValue(locale, { en: `${action} quote for ${targetMessage.author.tag}: "${formatQuotePreview(quoteText)}"`, nl: `${action} citaat van ${targetMessage.author.tag}: "${formatQuotePreview(quoteText)}"` }),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
