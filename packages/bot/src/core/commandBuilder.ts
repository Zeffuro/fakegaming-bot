import {ApplicationCommandType, ContextMenuCommandBuilder, SlashCommandBuilder} from 'discord.js';

/**
 * Create a SlashCommandBuilder using manifest metadata for name and description,
 * while allowing the caller to add options via the provided callback.
 */
export function createSlashCommand(
    meta: { name: string; description: string },
    addOptions?: (b: SlashCommandBuilder) => void
): SlashCommandBuilder {
    const builder = new SlashCommandBuilder()
        .setName(meta.name)
        .setDescription(meta.description);
    if (addOptions) addOptions(builder);
    return builder;
}

export function createUserContextCommand(meta: { name: string }): ContextMenuCommandBuilder {
    return new ContextMenuCommandBuilder()
        .setName(meta.name)
        .setType(ApplicationCommandType.User);
}

export function createMessageContextCommand(meta: { name: string }): ContextMenuCommandBuilder {
    return new ContextMenuCommandBuilder()
        .setName(meta.name)
        .setType(ApplicationCommandType.Message);
}

/**
 * Return manifest testOnly flag if present and boolean, else false.
 */
export function getTestOnly(meta: { [k: string]: unknown }): boolean {
    const v = meta as { testOnly?: unknown };
    return typeof v.testOnly === 'boolean' ? v.testOnly : false;
}
