import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { months } from '../../../constants/months.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { birthday as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addUserOption(option =>
        option.setName('user')
            .setDescription('User to look up (optional)')
            .setRequired(false)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', false);
    const userId = targetUser?.id ?? interaction.user.id;
    const guildId = interaction.guildId!;

    const birthday = await getConfigManager().birthdayManager.getBirthday(userId, guildId);
    if (!birthday) {
        await interaction.reply({
            content: `${targetUser ? `<@${userId}>` : "You"} do not have a birthday set in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const dateStr = `${birthday.day} ${months[birthday.month - 1].name}${birthday.year ? ` ${birthday.year}` : ''}`;
    await interaction.reply({
        content: `${targetUser ? `<@${userId}>'s` : "Your"} birthday: ${dateStr}`,
        flags: MessageFlags.Ephemeral
    });
}

export default { data, execute, testOnly: getTestOnly(META) };
