import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits} from 'discord.js';
import {resolveInteractionOutputLocale, resolveLocaleValue} from '../core/localization.js';

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        const locale = await resolveInteractionOutputLocale(interaction);
        await interaction.reply({
            content: resolveLocaleValue(locale, {
                en: 'Only admins can use this command.',
                nl: 'Alleen beheerders kunnen deze opdracht gebruiken.',
            }),
            flags: MessageFlags.Ephemeral,
        });
        return false;
    }
    return true;
}
