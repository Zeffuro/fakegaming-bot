import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags
} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {months} from "../../../constants/months.js";

export const data = new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Show your or another user\'s birthday')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to look up (optional)')
            .setRequired(false)
    )

export const testOnly = true;

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', false);

    let userId = interaction.user.id;
    if (targetUser) userId = targetUser.id;

    const birthday = configManager.birthdayManager.getBirthday({userId, guildId: interaction.guildId!});

    if (!birthday) {
        await interaction.reply({
            content: `${targetUser ? `<@${targetUser.id}>` : "You"} do not have a birthday set in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const dateStr = `${birthday.day} ${months[birthday.month - 1].name}${birthday.year ? ` ${birthday.year}` : ""}`;
    await interaction.reply({
        content: `${targetUser ? `<@${targetUser.id}>'s` : "Your"} birthday: ${dateStr}`,
        flags: MessageFlags.Ephemeral
    });
}