import {SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, MessageFlags, TextBasedChannel} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {requireAdmin} from '../../../utils/permissions.js';
import {testNotification as META} from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to send the test notification to')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Optional custom test message')
                .setRequired(false)
        )
);

async function execute(interaction: ChatInputCommandInteraction) {
    if (!await requireAdmin(interaction)) return;

    const selected = interaction.options.getChannel('channel') as TextBasedChannel | null;
    const target = selected ?? interaction.channel;
    if (!target || !('send' in target)) {
        await interaction.reply({content: 'I cannot send a test notification in that channel.', flags: MessageFlags.Ephemeral});
        return;
    }

    const message = interaction.options.getString('message') ?? 'This is a test notification from Fakegaming Bot.';
    await target.send({
        content: message,
        embeds: [{
            title: 'Test Notification',
            description: 'If you can see this, bot notifications can be delivered to this channel.',
            color: 0x68D7FF,
            timestamp: new Date().toISOString(),
        }],
    });

    await interaction.reply({content: `Sent a test notification to ${target}.`, flags: MessageFlags.Ephemeral});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
