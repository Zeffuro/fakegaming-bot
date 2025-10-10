import {EmbedBuilder} from 'discord.js';
import {PatchNoteConfig} from '@zeffuro/fakegaming-common/models';
import {truncateDescription} from '../../../utils/generalUtils.js';
import {parseDateSafe} from '@zeffuro/fakegaming-common/utils';
import {CreationAttributes} from 'sequelize';

export function buildPatchNoteEmbed(note: PatchNoteConfig | CreationAttributes<PatchNoteConfig>): EmbedBuilder {
    const publishedAt = parseDateSafe(note.publishedAt);
    const embed = new EmbedBuilder()
        .setColor(note.accentColor ?? 0x5865F2)
        .setTitle(note.title)
        .setDescription(truncateDescription(note.content, 350))
        .setURL(note.url)
        .setImage(note.imageUrl ?? null)
        .setTimestamp(publishedAt ?? new Date())
        .setThumbnail(note.logoUrl ?? null)
        .setAuthor({name: note.game});

    if (publishedAt) {
        embed.setFooter({text: publishedAt.toLocaleString()});
    }

    return embed;
}