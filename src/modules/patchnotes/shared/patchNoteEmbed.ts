import {EmbedBuilder} from 'discord.js';
import {PatchNoteConfig} from '../../../models/patch-note-config.js';
import {truncateDescription} from '../../../utils/generalUtils.js';

export function buildPatchNoteEmbed(note: PatchNoteConfig): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(note.accentColor ?? 0x5865F2)
        .setTitle(note.title)
        .setDescription(truncateDescription(note.content, 350))
        .setURL(note.url)
        .setImage(note.imageUrl ?? null)
        .setTimestamp(new Date(note.publishedAt))
        .setFooter({text: new Date(note.publishedAt).toLocaleString()})
        .setThumbnail(note.logoUrl ?? null)
        .setAuthor({name: note.game});
}