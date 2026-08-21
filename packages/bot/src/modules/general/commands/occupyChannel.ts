import {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { occupyChannel as META } from '../commands.manifest.js';
import { getGeneralCopy } from '../data/generalCopy.js';
import {
    voiceChannelOccupancyRuntime,
} from '../shared/voiceChannelOccupancyRuntime.js';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(command => command
            .setName('enable')
            .setNameLocalization('nl', 'inschakelen')
            .setDescription('Keep a voice channel occupied while the bot is online')
            .setDescriptionLocalization('nl', 'Houd een spraakkanaal bezet zolang de bot online is')
            .addChannelOption(option => option
                .setName('channel')
                .setNameLocalization('nl', 'kanaal')
                .setDescription('Voice channel for the bot to occupy')
                .setDescriptionLocalization('nl', 'Spraakkanaal dat de bot bezet houdt')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)))
        .addSubcommand(command => command
            .setName('disable')
            .setNameLocalization('nl', 'uitschakelen')
            .setDescription('Stop occupying the configured voice channel')
            .setDescriptionLocalization('nl', 'Stop met het bezet houden van het ingestelde spraakkanaal'))
        .addSubcommand(command => command
            .setName('status')
            .setNameLocalization('nl', 'status')
            .setDescription('Show the occupied voice channel and connection state')
            .setDescriptionLocalization('nl', 'Toon het bezette spraakkanaal en de verbindingsstatus'))
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale).occupyChannel;
    if (!interaction.guildId) {
        await interaction.reply({ content: copy.serverOnly, flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireAdmin(interaction)) return;

    const manager = getConfigManager().voiceChannelOccupancyConfigManager;
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand === 'enable') {
        const channel = interaction.options.getChannel('channel', true);
        const previous = await manager.getForGuild(interaction.guildId);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const config = { guildId: interaction.guildId, channelId: channel.id };
        const result = await voiceChannelOccupancyRuntime.configure(interaction.client, config);
        if (result.state === 'failed') {
            await interaction.editReply(copy.failure[result.code]);
            return;
        }

        try {
            await manager.setForGuild(config.guildId, config.channelId);
        } catch (error) {
            if (previous) await voiceChannelOccupancyRuntime.configure(interaction.client, previous);
            else await voiceChannelOccupancyRuntime.disable(config.guildId);
            throw error;
        }

        await interaction.editReply(result.state === 'ready'
            ? copy.enabled(channel.id)
            : copy.enabledRetrying(channel.id));
        return;
    }

    if (subcommand === 'disable') {
        const removed = await manager.disableForGuild(interaction.guildId);
        await voiceChannelOccupancyRuntime.disable(interaction.guildId);
        await interaction.reply({
            content: removed ? copy.disabled : copy.alreadyDisabled,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const config = await manager.getForGuild(interaction.guildId);
    if (!config) {
        await interaction.reply({ content: copy.statusDisabled, flags: MessageFlags.Ephemeral });
        return;
    }

    const status = voiceChannelOccupancyRuntime.getStatus(config.guildId, config.channelId);
    await interaction.reply({
        content: statusCopy(copy, status, config.channelId),
        flags: MessageFlags.Ephemeral,
    });
}

function statusCopy(
    copy: ReturnType<typeof getGeneralCopy>['occupyChannel'],
    status: ReturnType<typeof voiceChannelOccupancyRuntime.getStatus>,
    channelId: string,
): string {
    if (status === 'ready') return copy.statusReady(channelId);
    if (status === 'connecting') return copy.statusConnecting(channelId);
    return copy.statusDisconnected(channelId);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
