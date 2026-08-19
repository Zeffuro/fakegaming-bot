import {MessageContextMenuCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createMessageContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {saveMessageToNotes as META} from '../commands.manifest.js';

const data = createMessageContextCommand(META);
const MAX_EXCERPT_LENGTH = 1500;

async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const targetMessage = interaction.targetMessage;
    const messageLink = targetMessage.url || buildMessageLink(interaction.guildId, targetMessage.channelId, targetMessage.id);
    const excerpt = truncateExcerpt(targetMessage.content.trim());
    const attachmentSummary = describeNonTextContent(targetMessage);
    const body = [
        excerpt || attachmentSummary || '[Message has no text content.]',
        '',
        `Source: ${messageLink}`,
    ].join('\n');

    try {
        const note = await getConfigManager().userNoteManager.createForUser({
            discordId: interaction.user.id,
            title: 'Saved message',
            body,
        });

        await interaction.reply({
            content: `Saved this message to your private notes as \`${note.id.slice(0, 8)}\`.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: {parse: []},
        });
    } catch {
        await interaction.reply({
            content: 'I could not save that message to your private notes. Please try again later.',
            flags: MessageFlags.Ephemeral,
            allowedMentions: {parse: []},
        });
    }
}

function buildMessageLink(guildId: string | null, channelId: string, messageId: string): string {
    const scope = guildId ?? '@me';
    return `https://discord.com/channels/${scope === '@me' ? scope : encodeURIComponent(scope)}/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`;
}

function truncateExcerpt(content: string): string {
    if (content.length <= MAX_EXCERPT_LENGTH) return content;
    return `${content.slice(0, MAX_EXCERPT_LENGTH - 3)}...`;
}

function describeNonTextContent(message: MessageContextMenuCommandInteraction['targetMessage']): string | null {
    const attachments = message.attachments?.size ?? 0;
    const stickers = message.stickers?.size ?? 0;
    if (attachments === 0 && stickers === 0) return null;

    const parts: string[] = [];
    if (attachments > 0) parts.push(`${attachments} attachment${attachments === 1 ? '' : 's'}`);
    if (stickers > 0) parts.push(`${stickers} sticker${stickers === 1 ? '' : 's'}`);
    return `[Message contains ${parts.join(' and ')}; files were not downloaded.]`;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
