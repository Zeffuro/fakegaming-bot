import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {EmbedBuilder} from 'discord.js';
import {PatchNoteConfig} from '@zeffuro/fakegaming-common/models';
import {parseDateSafe} from '@zeffuro/fakegaming-common/utils';
import {formatPatchNoteEmbedDescription} from '@zeffuro/fakegaming-common/patchnotes';
import {CreationAttributes} from 'sequelize';
import type {SupportedOutputLocale} from '../../../core/localization.js';

interface PatchNoteEmbedSource {
    game: string;
    title: string;
    content: string;
    url: string;
    publishedAt: string | number | Date;
    accentColor?: number | null;
    imageUrl?: string | null;
    logoUrl?: string | null;
}

export function buildPatchNoteEmbed(
    note: PatchNoteConfig | CreationAttributes<PatchNoteConfig> | PatchNoteEmbedSource,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): EmbedBuilder {
    const publishedAt = parseDateSafe(note.publishedAt);
    const embed = new EmbedBuilder()
        .setColor(note.accentColor ?? 0x5865F2)
        .setTitle(note.title)
        .setDescription(formatPatchNoteEmbedDescription(note.content))
        .setURL(note.url)
        .setImage(note.imageUrl ?? null)
        .setTimestamp(publishedAt ?? new Date())
        .setThumbnail(note.logoUrl ?? null)
        .setAuthor({name: note.game});

    if (publishedAt) {
        embed.setFooter({text: publishedAt.toLocaleString(resolveLocaleValue(locale, { en: 'en-US', nl: 'nl-NL' }))});
    }

    return embed;
}
