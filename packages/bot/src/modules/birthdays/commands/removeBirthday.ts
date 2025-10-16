import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { requireAdmin } from '../../../utils/permissions.js';
import { subjectForUser } from '../shared/messages.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { removeBirthday as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addUserOption(option =>
        option.setName('user')
            .setDescription('User to remove birthday for (admins only)')
            .setRequired(false)
    )
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
        content: `${subjectForUser(targetUser ? userId : null)} birthday has been removed.`,
        flags: MessageFlags.Ephemeral
    });
}

export default { data, execute, testOnly: getTestOnly(META) };
