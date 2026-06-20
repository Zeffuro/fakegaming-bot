import {MessageContextMenuCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {v4 as uuidv4} from 'uuid';
import {createMessageContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {saveMessageAsQuote as META} from '../commands.manifest.js';
import {formatQuotePreview} from '../shared/formatQuotes.js';

const data = createMessageContextCommand(META);

async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: 'Saving quotes only works in a server.', flags: MessageFlags.Ephemeral});
        return;
    }

    const targetMessage = interaction.targetMessage;
    const quoteText = targetMessage.content.trim();
    if (!quoteText) {
        await interaction.reply({
            content: 'That message has no text content to save as a quote.',
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

    const action = created ? 'Saved' : 'Updated';
    await interaction.reply({
        content: `${action} quote for ${targetMessage.author.tag}: "${formatQuotePreview(quoteText)}"`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
