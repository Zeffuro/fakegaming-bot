import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {verifyTwitchUser} from '../../../services/twitchService.js';
import {requireAdmin} from '../../../utils/permissions.js';

const data = new SlashCommandBuilder()
    .setName('add-twitch-stream')
    .setDescription('Add a Twitch stream for notifications')
    .addStringOption(option =>
        option.setName('username')
            .setDescription('Twitch username')
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
 * Executes the add-twitch-stream command, adding a Twitch stream for notifications in a Discord channel.
 * Checks admin permissions, validates the Twitch user, prevents duplicates, and adds the stream for notifications.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireAdmin(interaction))) return;

    const twitchUsername = interaction.options.getString('username', true);
    const discordChannel = interaction.options.getChannel('channel', true);
    const customMessage = interaction.options.getString('message', false) ?? undefined;

    const existing = configManager.twitchManager.getAll().find(
        stream => stream.twitchUsername === twitchUsername && stream.discordChannelId === discordChannel.id
    );
    if (existing) {
        await interaction.reply({
            content: `Twitch stream \`${twitchUsername}\` is already configured for notifications in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!(await verifyTwitchUser(twitchUsername))) {
        await interaction.reply({
            content: `Twitch user \`${twitchUsername}\` does not exist.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await configManager.twitchManager.add({
        twitchUsername,
        discordChannelId: discordChannel.id,
        customMessage,
    });

    await interaction.reply(`Twitch stream \`${twitchUsername}\` added for notifications in <#${discordChannel.id}>.`);
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};