import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';
import {months} from "../../../constants/months.js";

const data = new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Show your or another user\'s birthday')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to look up (optional)')
            .setRequired(false)
    );

/**
 * Executes the birthday command, replying with the birthday of the user or another user in the channel.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', false);

    let userId = interaction.user.id;
    if (targetUser) userId = targetUser.id;

    const birthday = await getConfigManager().birthdayManager.getBirthday({userId, guildId: interaction.guildId!});

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

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};