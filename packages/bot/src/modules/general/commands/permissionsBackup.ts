import { gzipSync } from 'node:zlib';
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { RolePermissionSnapshotData } from '@zeffuro/fakegaming-common/models';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { permissionsBackup as META } from '../commands.manifest.js';
import { captureRolePermissionSnapshot } from '../shared/rolePermissionSnapshot.js';

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Capture role, member, category, and channel permissions')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List the most recent saved permission snapshots')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('export')
                .setDescription('Download a saved permission snapshot')
                .addIntegerOption(option =>
                    option
                        .setName('id')
                        .setDescription('Snapshot ID from the list')
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'Permission backups only work in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: 'Only server administrators can access permission backups.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const action = interaction.options.getSubcommand(true);
    if (action === 'create') {
        await createSnapshot(interaction);
        return;
    }

    if (action === 'list') {
        await listSnapshots(interaction);
        return;
    }

    await exportSnapshot(interaction);
}

async function createSnapshot(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const snapshot = await captureRolePermissionSnapshot(guild);
    const saved = await getConfigManager().rolePermissionSnapshotManager.createSnapshot({
        guildId: guild.id,
        guildName: guild.name,
        createdById: interaction.user.id,
        snapshot,
    });
    const attachment = createSnapshotAttachment(snapshot, saved.id);

    await interaction.editReply({
        content: formatCreatedSnapshot(saved.id, snapshot, attachment),
        ...(attachment.file ? { files: [attachment.file] } : {}),
    });
}

async function listSnapshots(interaction: ChatInputCommandInteraction): Promise<void> {
    const snapshots = await getConfigManager().rolePermissionSnapshotManager.listSnapshots(interaction.guildId!, 10);
    if (snapshots.length === 0) {
        await interaction.reply({
            content: 'No permission snapshots have been saved for this server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const lines = snapshots.map(snapshot => {
        const timestamp = Math.floor(snapshot.createdAt.getTime() / 1000);
        return `#${snapshot.id} - <t:${timestamp}:f> - ${formatSnapshotSummary(snapshot.snapshot)}`;
    });

    await interaction.reply({
        content: `Recent permission snapshots:\n${lines.join('\n')}`,
        flags: MessageFlags.Ephemeral,
    });
}

async function exportSnapshot(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getInteger('id', true);
    const snapshot = await getConfigManager().rolePermissionSnapshotManager.getSnapshot(interaction.guildId!, id);
    if (!snapshot) {
        await interaction.reply({
            content: `Permission snapshot #${id} was not found for this server.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const attachment = createSnapshotAttachment(snapshot.snapshot, snapshot.id);
    await interaction.reply({
        content: attachment.file
            ? `Permission snapshot #${snapshot.id}: ${formatSnapshotSummary(snapshot.snapshot)}`
            : `Permission snapshot #${snapshot.id} is too large for a single Discord attachment.`,
        ...(attachment.file ? { files: [attachment.file] } : {}),
        flags: MessageFlags.Ephemeral,
    });
}

function createSnapshotAttachment(snapshot: RolePermissionSnapshotData, id: number): {
    file: AttachmentBuilder | null;
    compressed: boolean;
} {
    const json = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8');
    const basename = `role-permissions-${snapshot.guild.id}-snapshot-${id}`;

    if (json.byteLength <= MAX_ATTACHMENT_BYTES) {
        return {
            file: new AttachmentBuilder(json, { name: `${basename}.json` }),
            compressed: false,
        };
    }

    const compressed = gzipSync(json);
    if (compressed.byteLength <= MAX_ATTACHMENT_BYTES) {
        return {
            file: new AttachmentBuilder(compressed, { name: `${basename}.json.gz` }),
            compressed: true,
        };
    }

    return { file: null, compressed: true };
}

function formatCreatedSnapshot(
    id: number,
    snapshot: RolePermissionSnapshotData,
    attachment: { file: AttachmentBuilder | null; compressed: boolean },
): string {
    const attachmentNote = attachment.file
        ? attachment.compressed ? ' The attached export is gzip-compressed.' : ''
        : ' The export exceeds Discord\'s attachment limit, but the snapshot was saved.';
    const memberNote = snapshot.memberData.fetchFailed
        ? ' Discord did not provide a complete member list, so cached members were used.'
        : '';
    const roleNote = snapshot.roleData.fetchFailed
        ? ' Discord did not provide refreshed role data, so cached roles were used.'
        : '';
    const channelNote = snapshot.channelData.fetchFailed
        ? ' Discord did not provide refreshed channel data, so cached channels were used.'
        : '';
    return `Saved permission snapshot #${id}: ${formatSnapshotSummary(snapshot)}.${attachmentNote}${roleNote}${memberNote}${channelNote}`;
}

function formatSnapshotSummary(snapshot: RolePermissionSnapshotData): string {
    return `${snapshot.roles.length} roles, ${snapshot.memberData.source} members (${snapshot.memberData.capturedMemberCount}), ${snapshot.channels.length} categories/channels`;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
