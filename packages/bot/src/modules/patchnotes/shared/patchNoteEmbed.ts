import {EmbedBuilder} from 'discord.js';
import {PatchNoteConfig} from '@zeffuro/fakegaming-common/models';
import {truncateDescription} from '../../../utils/generalUtils.js';
import {parseDateSafe} from "../../../utils/timeUtils.js";

export function buildPatchNoteEmbed(note: PatchNoteConfig): EmbedBuilder {
    const publishedAt = parseDateSafe(note.publishedAt);
    return new EmbedBuilder()
        .setColor(note.accentColor ?? 0x5865F2)
        .setTitle(note.title)
        .setDescription(truncateDescription(note.content, 350))
        .setURL(note.url)
        .setImage(note.imageUrl ?? null)
        .setTimestamp(publishedAt ?? new Date())
        .setFooter({text: publishedAt ? publishedAt.toLocaleString() : ''})
        .setThumbnail(note.logoUrl ?? null)
        .setAuthor({name: note.game});
}