import {MessageContextMenuCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createMessageContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {saveMessageToNotes as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../../core/localization.js';
import {getNotesCopy} from '../copy/notesCopy.js';

const data = createMessageContextCommand(META);
const MAX_EXCERPT_LENGTH = 1500;

async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getNotesCopy(locale);
    const targetMessage = interaction.targetMessage;
    const messageLink = targetMessage.url || buildMessageLink(interaction.guildId, targetMessage.channelId, targetMessage.id);
    const excerpt = truncateExcerpt(targetMessage.content.trim());
    const attachmentSummary = describeNonTextContent(targetMessage, locale);
    const body = [
        excerpt || attachmentSummary || copy.emptyMessage,
        '',
        `${copy.source}: ${messageLink}`,
    ].join('\n');

    try {
        const note = await getConfigManager().userNoteManager.createForUser({
            discordId: interaction.user.id,
            title: copy.savedMessageTitle,
            body,
            locale,
        });

        await interaction.reply({
            content: copy.contextSaved(note.id.slice(0, 8)),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {parse: []},
        });
    } catch {
        await interaction.reply({
            content: copy.contextFailed,
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

function describeNonTextContent(
    message: MessageContextMenuCommandInteraction['targetMessage'],
    locale: SupportedOutputLocale,
): string | null {
    const copy = getNotesCopy(locale);
    const attachments = message.attachments?.size ?? 0;
    const stickers = message.stickers?.size ?? 0;
    if (attachments === 0 && stickers === 0) return null;

    const parts: string[] = [];
    if (attachments > 0) parts.push(copy.attachments(attachments));
    if (stickers > 0) parts.push(copy.stickers(stickers));
    return copy.messageContains(parts.join(` ${copy.and} `));
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
