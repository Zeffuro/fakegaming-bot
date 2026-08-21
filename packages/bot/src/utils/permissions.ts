import { runtimeText } from '../core/runtimeCopy.js';
import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits} from 'discord.js';
import {resolveInteractionOutputLocale} from '../core/localization.js';

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        const locale = await resolveInteractionOutputLocale(interaction);
        await interaction.reply({
            content: runtimeText(locale, "core", "onlyAdminsCanUseThisCommand"),
            flags: MessageFlags.Ephemeral,
        });
        return false;
    }
    return true;
}
