import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits} from 'discord.js';

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({content: 'Only admins can use this command.', flags: MessageFlags.Ephemeral});
        return false;
    }
    return true;
}