import {ApplicationCommandType, ContextMenuCommandBuilder, SlashCommandBuilder} from 'discord.js';
import {type NonDefaultOutputLocale} from '@zeffuro/fakegaming-common';
import {attachCommandLocalizations} from './commandLocalization.js';

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
    if (addOptions) addOptions(builder);
    return attachCommandLocalizations(builder, meta.name, meta.localizations);
}

export function createUserContextCommand(meta: Pick<LocalizedCommandMetadata, 'name' | 'localizations'>): ContextMenuCommandBuilder {
    const builder = new ContextMenuCommandBuilder()
        .setName(meta.name)
        .setType(ApplicationCommandType.User);
    return attachCommandLocalizations(builder, meta.name, meta.localizations);
}

export function createMessageContextCommand(meta: Pick<LocalizedCommandMetadata, 'name' | 'localizations'>): ContextMenuCommandBuilder {
    const builder = new ContextMenuCommandBuilder()
        .setName(meta.name)
        .setType(ApplicationCommandType.Message);
    return attachCommandLocalizations(builder, meta.name, meta.localizations);
}

/**
 * Return manifest testOnly flag if present and boolean, else false.
 */
export function getTestOnly(meta: object): boolean {
    const v = meta as { testOnly?: unknown };
    return typeof v.testOnly === 'boolean' ? v.testOnly : false;
}
