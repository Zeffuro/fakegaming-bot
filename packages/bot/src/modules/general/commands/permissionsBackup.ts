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
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { getGeneralCopy } from '../data/generalCopy.js';
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
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Permanently delete a saved permission snapshot')
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
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale).permissions;
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: copy.serverOnly,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: copy.adminOnly,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const action = interaction.options.getSubcommand(true);
    if (action === 'create') {
        await createSnapshot(interaction, locale);
        return;
    }

    if (action === 'list') {
        await listSnapshots(interaction, locale);
        return;
    }

    if (action === 'export') {
        await exportSnapshot(interaction, locale);
        return;
    }

    await deleteSnapshot(interaction, locale);
}

async function createSnapshot(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
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
        content: formatCreatedSnapshot(saved.id, snapshot, attachment, locale),
        ...(attachment.file ? { files: [attachment.file] } : {}),
    });
}

async function listSnapshots(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getGeneralCopy(locale).permissions;
    const snapshots = await getConfigManager().rolePermissionSnapshotManager.listSnapshots(interaction.guildId!, 10);
    if (snapshots.length === 0) {
        await interaction.reply({
            content: copy.none,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const lines = snapshots.map(snapshot => {
        const timestamp = Math.floor(snapshot.createdAt.getTime() / 1000);
        return `#${snapshot.id} - <t:${timestamp}:f> - ${formatSnapshotSummary(snapshot.snapshot, locale)}`;
    });

    await interaction.reply({
        content: `${copy.recent}\n${lines.join('\n')}`,
        flags: MessageFlags.Ephemeral,
    });
}

async function exportSnapshot(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getGeneralCopy(locale).permissions;
    const id = interaction.options.getInteger('id', true);
    const snapshot = await getConfigManager().rolePermissionSnapshotManager.getSnapshot(interaction.guildId!, id);
    if (!snapshot) {
        await interaction.reply({
            content: copy.notFound(id),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const attachment = createSnapshotAttachment(snapshot.snapshot, snapshot.id);
    await interaction.reply({
        content: attachment.file
            ? `${copy.snapshot(snapshot.id)}: ${formatSnapshotSummary(snapshot.snapshot, locale)}`
            : copy.tooLarge(snapshot.id),
        ...(attachment.file ? { files: [attachment.file] } : {}),
        flags: MessageFlags.Ephemeral,
    });
}

async function deleteSnapshot(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const copy = getGeneralCopy(locale).permissions;
    const id = interaction.options.getInteger('id', true);
    const deleted = await getConfigManager().rolePermissionSnapshotManager.deleteSnapshot(interaction.guildId!, id);
    await interaction.reply({
        content: deleted
            ? copy.deleted(id)
            : copy.notFound(id),
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
    locale: SupportedOutputLocale,
): string {
    const copy = getGeneralCopy(locale).permissions;
    const attachmentNote = attachment.file
        ? attachment.compressed ? copy.compressed : ''
        : copy.attachmentTooLarge;
    const memberNote = snapshot.memberData.fetchFailed
        ? copy.partialMembers
        : '';
    const roleNote = snapshot.roleData.fetchFailed
        ? copy.partialRoles
        : '';
    const channelNote = snapshot.channelData.fetchFailed
        ? copy.partialChannels
        : '';
    return `${copy.saved(id)}: ${formatSnapshotSummary(snapshot, locale)}.${attachmentNote}${roleNote}${memberNote}${channelNote}`;
}

function formatSnapshotSummary(snapshot: RolePermissionSnapshotData, locale: SupportedOutputLocale): string {
    return getGeneralCopy(locale).permissions.summary(
        snapshot.roles.length,
        snapshot.memberData.source,
        snapshot.memberData.capturedMemberCount,
        snapshot.channels.length,
    );
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
