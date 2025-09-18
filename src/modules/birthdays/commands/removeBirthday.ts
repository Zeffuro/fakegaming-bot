import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {requireAdmin} from '../../../utils/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('remove-birthday')
    .setDescription('Remove your birthday or another user\'s birthday (admins only)')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to remove birthday for (admins only)')
            .setRequired(false)
    );

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', false);
    const guildId = interaction.guildId!;
    let userId = interaction.user.id;

    if (targetUser) {
        if (!await requireAdmin(interaction)) return;
        userId = targetUser.id;
    }

    await configManager.birthdayManager.removeBirthday({userId, guildId});

    await interaction.reply({
        content: `${targetUser ? `<@${targetUser.id}>'s` : "Your"} birthday has been removed.`,
        flags: MessageFlags.Ephemeral
    });
}