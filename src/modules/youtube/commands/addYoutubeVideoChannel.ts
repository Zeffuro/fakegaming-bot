import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {getYoutubeChannelId} from '../../../services/youtubeService.js';
import {requireAdmin} from '../../../utils/permissions.js';

const data = new SlashCommandBuilder()
    .setName('add-youtube-channel')
    .setDescription('Add a Youtube Channel for new video notifications')
    .addStringOption(option =>
        option.setName('username')
            .setDescription('Youtube username')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Discord channel for notifications')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('message')
            .setDescription('Custom notification message (optional)')
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


/**
 * Executes the add-youtube-channel command, adding a YouTube channel for video notifications in a Discord channel.
 * Checks admin permissions, validates the YouTube channel, prevents duplicates, and adds the channel for notifications.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireAdmin(interaction))) return;

    const youtubeUsername = interaction.options.getString('username', true);
    const discordChannel = interaction.options.getChannel('channel', true);
    const customMessage = interaction.options.getString('message', false) ?? undefined;

    let youtubeChannelId: string | null;
    youtubeChannelId = await getYoutubeChannelId(youtubeUsername);
    if (!youtubeChannelId) {
        await interaction.reply({
            content: `Youtube channel \`${youtubeUsername}\` does not exist.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const existing = await configManager.youtubeManager.getVideoChannel({
        youtubeChannelId,
        discordChannelId: discordChannel.id
    });

    if (existing) {
        await interaction.reply({
            content: `Youtube channel \`${youtubeUsername}\` is already configured for video notifications in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await configManager.youtubeManager.addVideoChannel({
        youtubeChannelId,
        discordChannelId: discordChannel.id,
        lastVideoId: undefined,
        customMessage,
    });

    await interaction.reply(`Youtube channel \`${youtubeUsername}\` added for video notifications in #${discordChannel.id}.`);
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};