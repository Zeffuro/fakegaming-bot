import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits} from 'discord.js';

/**
 * Checks if the interaction is from an admin. Replies with an error if not.
 * @param interaction The Discord interaction to check.
 * @returns True if the user is an admin, false otherwise.
 */
export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({content: 'Only admins can use this command.', flags: MessageFlags.Ephemeral});
        return false;
    }
    return true;
}