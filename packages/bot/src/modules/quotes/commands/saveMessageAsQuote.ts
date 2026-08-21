import { runtimeText } from '../../../core/runtimeCopy.js';
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
        await interaction.reply({content: runtimeText(locale, "quotes", "savingQuotesOnlyWorksInAServer"), flags: MessageFlags.Ephemeral});
        return;
    }

    const targetMessage = interaction.targetMessage;
    const quoteText = targetMessage.content.trim();
    if (!quoteText) {
        await interaction.reply({
            content: runtimeText(locale, "quotes", "thatMessageHasNoTextContentToSave"),
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

    const action = runtimeText(locale, 'quotes', 'saveAction', {created: String(created)});
    await interaction.reply({
        content: runtimeText(locale, 'quotes', 'savedQuote', {
            action, author: targetMessage.author.tag, quote: formatQuotePreview(quoteText),
        }),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
