import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { requireAdmin } from '../../../utils/permissions.js';

const data = new SlashCommandBuilder()
    .setName('remove-birthday')
    .setDescription("Remove your birthday or another user's birthday (admins only)")
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to remove birthday for (admins only)')
            .setRequired(false)
    );

async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', false);
    const guildId = interaction.guildId!;
    let userId = interaction.user.id;

    if (targetUser) {
        if (!await requireAdmin(interaction)) return;
        userId = targetUser.id;
    }

    await getConfigManager().birthdayManager.removeBirthday(userId, guildId);

    await interaction.reply({
        content: `${targetUser ? `<@${userId}>'s` : "Your"} birthday has been removed.`,
        flags: MessageFlags.Ephemeral
    });
}

export default { data, execute, testOnly: false };
