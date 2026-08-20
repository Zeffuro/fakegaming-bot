import {ApplicationCommandType, ContextMenuCommandBuilder, SlashCommandBuilder} from 'discord.js';
import {
    NON_DEFAULT_OUTPUT_LOCALES,
    type NonDefaultOutputLocale,
} from '@zeffuro/fakegaming-common';

export interface LocalizedCommandMetadata {
    name: string;
    description: string;
    localizations?: Record<
        NonDefaultOutputLocale,
        {
            name: string;
            description: string;
        }
    >;
}

/**
 * Create a SlashCommandBuilder using manifest metadata for name and description,
 * while allowing the caller to add options via the provided callback.
 */
export function createSlashCommand(
    meta: LocalizedCommandMetadata,
    addOptions?: (b: SlashCommandBuilder) => void
): SlashCommandBuilder {
    const builder = new SlashCommandBuilder()
        .setName(meta.name)
        .setDescription(meta.description);
    for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
        const translation = meta.localizations?.[locale];
        if (!translation) continue;
        builder
            .setNameLocalization(locale, translation.name)
            .setDescriptionLocalization(locale, translation.description);
    }
    if (addOptions) addOptions(builder);
    return builder;
}

export function createUserContextCommand(meta: Pick<LocalizedCommandMetadata, 'name' | 'localizations'>): ContextMenuCommandBuilder {
    const builder = new ContextMenuCommandBuilder()
        .setName(meta.name)
        .setType(ApplicationCommandType.User);
    for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
        const name = meta.localizations?.[locale]?.name;
        if (name) builder.setNameLocalization(locale, name);
    }
    return builder;
}

export function createMessageContextCommand(meta: Pick<LocalizedCommandMetadata, 'name' | 'localizations'>): ContextMenuCommandBuilder {
    const builder = new ContextMenuCommandBuilder()
        .setName(meta.name)
        .setType(ApplicationCommandType.Message);
    for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
        const name = meta.localizations?.[locale]?.name;
        if (name) builder.setNameLocalization(locale, name);
    }
    return builder;
}

/**
 * Return manifest testOnly flag if present and boolean, else false.
 */
export function getTestOnly(meta: object): boolean {
    const v = meta as { testOnly?: unknown };
    return typeof v.testOnly === 'boolean' ? v.testOnly : false;
}
