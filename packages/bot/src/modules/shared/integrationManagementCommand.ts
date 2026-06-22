import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import type {IntegrationHealthRecord, IntegrationHealthStatus} from '@zeffuro/fakegaming-common';
import {createSlashCommand, getTestOnly} from '../../core/commandBuilder.js';
import {requireAdmin} from '../../utils/permissions.js';
import {recordBotAuditEvent} from '../../utils/audit.js';

const MAX_LISTED_RECORDS = 20;
const MAX_REPLY_LENGTH = 1900;

export interface IntegrationManagementRecord {
    id: number;
    guildId: string;
    discordChannelId: string;
    paused?: boolean | null;
}

export interface IntegrationManagementCommandOptions<TRecord extends IntegrationManagementRecord> {
    meta: { name: string; description: string; testOnly?: boolean };
    subjectSingular: string;
    subjectPlural: string;
    listRecords: (guildId: string) => Promise<TRecord[]>;
    getRecord: (id: number) => Promise<TRecord | null>;
    removeRecord: (id: number) => Promise<void>;
    formatRecord: (record: TRecord) => string;
    describeRecord: (record: TRecord) => string;
    auditRemove?: {
        action: string;
        targetType: string;
        metadata?: (record: TRecord) => Record<string, unknown>;
    };
    setPausedRecord?: (id: number, paused: boolean) => Promise<void>;
    auditPause?: {
        pauseAction: string;
        resumeAction: string;
        targetType: string;
        metadata?: (record: TRecord, paused: boolean) => Record<string, unknown>;
    };
    health?: {
        provider: string;
        metadata?: (record: TRecord, paused: boolean) => Record<string, unknown>;
    };
}

/**
 * Creates a guild-admin-only slash command for listing, removing, pausing, and resuming integration configs.
 */
export function createIntegrationManagementCommand<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>
) {
    const data = createSlashCommand(opts.meta, (builder: SlashCommandBuilder) => {
        builder
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('list')
                    .setDescription(`List configured ${opts.subjectPlural}`)
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('remove')
                    .setDescription(`Remove a configured ${opts.subjectSingular}`)
                    .addIntegerOption((option) =>
                        option
                            .setName('id')
                            .setDescription(`Configuration ID from ${opts.meta.name} list`)
                            .setRequired(true)
                    )
            );
        if (opts.setPausedRecord) {
            builder
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('pause')
                        .setDescription(`Pause notifications for a configured ${opts.subjectSingular}`)
                        .addIntegerOption((option) =>
                            option
                                .setName('id')
                                .setDescription(`Configuration ID from ${opts.meta.name} list`)
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('resume')
                        .setDescription(`Resume notifications for a configured ${opts.subjectSingular}`)
                        .addIntegerOption((option) =>
                            option
                                .setName('id')
                                .setDescription(`Configuration ID from ${opts.meta.name} list`)
                                .setRequired(true)
                        )
                );
        }
        if (opts.health) {
            builder.addSubcommand((subcommand) =>
                subcommand
                    .setName('test')
                    .setDescription(`Show latest health for a configured ${opts.subjectSingular}`)
                    .addIntegerOption((option) =>
                        option
                            .setName('id')
                            .setDescription(`Configuration ID from ${opts.meta.name} list`)
                            .setRequired(true)
                    )
            );
        }
    });

    async function execute(interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId;
        if (!guildId) {
            await replyEphemeral(interaction, 'This command can only be used in a server.');
            return;
        }

        if (!(await requireAdmin(interaction))) return;

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') {
            await listRecords(interaction, guildId, opts);
            return;
        }

        if (subcommand === 'remove') {
            await removeRecord(interaction, guildId, opts);
            return;
        }

        if (subcommand === 'pause') {
            await setPausedRecord(interaction, guildId, opts, true);
            return;
        }

        if (subcommand === 'resume') {
            await setPausedRecord(interaction, guildId, opts, false);
            return;
        }

        if (subcommand === 'test') {
            await reportHealth(interaction, guildId, opts);
            return;
        }

        await replyEphemeral(interaction, `Unknown ${opts.subjectSingular} management action.`);
    }

    const testOnly = getTestOnly(opts.meta);
    return {data, execute, testOnly};
}

/**
 * Wraps untrusted text in Discord inline-code formatting without allowing backticks to break out.
 */
export function inlineCode(value: string): string {
    const escaped = value.replace(/`/g, "'");
    return `\`${escaped}\``;
}

async function listRecords<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>
): Promise<void> {
    const records = await opts.listRecords(guildId);
    if (records.length === 0) {
        await replyEphemeral(interaction, `No ${opts.subjectPlural} are configured for this server.`);
        return;
    }

    const visibleRecords = records.slice(0, MAX_LISTED_RECORDS);
    const lines = visibleRecords.map((record) => {
        const state = record.paused ? ' paused' : '';
        return `${opts.formatRecord(record)}${state}`;
    });
    const hiddenCount = records.length - visibleRecords.length;
    if (hiddenCount > 0) {
        lines.push(`Showing first ${MAX_LISTED_RECORDS}; ${hiddenCount} more not shown.`);
    }

    const content = truncateReply([
        `Configured ${opts.subjectPlural}:`,
        ...lines,
    ].join('\n'));
    await replyEphemeral(interaction, content);
}

async function removeRecord<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>
): Promise<void> {
    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyEphemeral(interaction, `That ${opts.subjectSingular} was not found in this server.`);
        return;
    }

    await opts.removeRecord(id);
    if (opts.auditRemove) {
        await recordBotAuditEvent(interaction, {
            action: opts.auditRemove.action,
            targetType: opts.auditRemove.targetType,
            targetId: id,
            guildId: record.guildId,
            metadata: opts.auditRemove.metadata?.(record) ?? null,
        });
    }
    await replyEphemeral(interaction, `Removed ${opts.subjectSingular} ${opts.describeRecord(record)}.`);
}

async function setPausedRecord<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>,
    paused: boolean
): Promise<void> {
    if (!opts.setPausedRecord) {
        await replyEphemeral(interaction, `That ${opts.subjectSingular} cannot be ${paused ? 'paused' : 'resumed'}.`);
        return;
    }

    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyEphemeral(interaction, `That ${opts.subjectSingular} was not found in this server.`);
        return;
    }

    if (Boolean(record.paused) === paused) {
        await replyEphemeral(interaction, `That ${opts.subjectSingular} ${opts.describeRecord(record)} is already ${paused ? 'paused' : 'active'}.`);
        return;
    }

    await opts.setPausedRecord(id, paused);

    if (opts.auditPause) {
        await recordBotAuditEvent(interaction, {
            action: paused ? opts.auditPause.pauseAction : opts.auditPause.resumeAction,
            targetType: opts.auditPause.targetType,
            targetId: id,
            guildId: record.guildId,
            metadata: opts.auditPause.metadata?.(record, paused) ?? null,
        });
    }

    await recordHealthStatus(record, opts, paused);
    await replyEphemeral(interaction, `${capitalizeAction(paused)}d ${opts.subjectSingular} ${opts.describeRecord(record)}.`);
}

async function reportHealth<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>
): Promise<void> {
    if (!opts.health) {
        await replyEphemeral(interaction, `That ${opts.subjectSingular} does not have health checks configured.`);
        return;
    }

    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyEphemeral(interaction, `That ${opts.subjectSingular} was not found in this server.`);
        return;
    }

    const integrationHealthManager = getIntegrationHealthManager();
    if (typeof integrationHealthManager.getForConfig !== 'function') {
        await replyEphemeral(interaction, `Health data is not available for ${opts.subjectSingular} ${opts.describeRecord(record)}.`);
        return;
    }

    let health: IntegrationHealthRecord | null;
    try {
        health = await integrationHealthManager.getForConfig(opts.health.provider, id);
    } catch {
        await replyEphemeral(interaction, `Health data could not be loaded for ${opts.subjectSingular} ${opts.describeRecord(record)}.`);
        return;
    }

    if (!health) {
        await replyEphemeral(
            interaction,
            `No health record has been recorded yet for ${opts.subjectSingular} ${opts.describeRecord(record)}. The next worker poll will populate it.`
        );
        return;
    }

    await replyEphemeral(interaction, formatHealthReply(opts.subjectSingular, opts.describeRecord(record), health));
}

async function replyEphemeral(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    await interaction.reply({content, flags: MessageFlags.Ephemeral});
}

function truncateReply(content: string): string {
    if (content.length <= MAX_REPLY_LENGTH) return content;
    const truncated = content.slice(0, MAX_REPLY_LENGTH - 13).trimEnd();
    return `${truncated}\n...truncated`;
}

async function recordHealthStatus<TRecord extends IntegrationManagementRecord>(
    record: TRecord,
    opts: IntegrationManagementCommandOptions<TRecord>,
    paused: boolean
): Promise<void> {
    if (!opts.health) return;
    const integrationHealthManager = getIntegrationHealthManager();
    if (typeof integrationHealthManager.recordStatus !== 'function') return;

    try {
        await integrationHealthManager.recordStatus({
            provider: opts.health.provider,
            configId: record.id,
            guildId: record.guildId,
            channelId: record.discordChannelId,
            status: paused ? 'paused' : 'unknown',
            metadata: {
                paused,
                ...(opts.health.metadata?.(record, paused) ?? {}),
            },
        });
    } catch {
        // Health status should not block the Discord management action.
    }
}

function capitalizeAction(paused: boolean): string {
    return paused ? 'Pause' : 'Resume';
}

function getIntegrationHealthManager(): {
    getForConfig?: (provider: string, configId: string | number) => Promise<IntegrationHealthRecord | null>;
    recordStatus?: (input: {
        provider: string;
        configId: string | number;
        guildId?: string | null;
        channelId?: string | null;
        status: IntegrationHealthStatus;
        metadata?: Record<string, unknown> | null;
    }) => Promise<void>;
} {
    return getConfigManager().integrationHealthManager as {
        getForConfig?: (provider: string, configId: string | number) => Promise<IntegrationHealthRecord | null>;
        recordStatus?: (input: {
            provider: string;
            configId: string | number;
            guildId?: string | null;
            channelId?: string | null;
            status: IntegrationHealthStatus;
            metadata?: Record<string, unknown> | null;
        }) => Promise<void>;
    };
}

function formatHealthReply(subjectSingular: string, recordDescription: string, health: IntegrationHealthRecord): string {
    const lines = [
        `Latest health for ${subjectSingular} ${recordDescription}:`,
        `Status: ${inlineCode(health.status)}`,
        `Last checked: ${formatHealthDate(health.lastCheckedAt)}`,
        `Last success: ${formatHealthDate(health.lastSuccessAt)}`,
        `Last failure: ${formatHealthDate(health.lastFailureAt)}`,
        `Last delivery: ${formatHealthDate(health.lastDeliveryAt)}`,
        `Consecutive failures: ${health.consecutiveFailures}`,
    ];

    if (health.lastErrorCode || health.lastErrorMessage) {
        const code = health.lastErrorCode ? `${inlineCode(health.lastErrorCode)} ` : '';
        lines.push(`Last error: ${code}${truncateHealthLine(health.lastErrorMessage ?? 'Unknown error')}`);
    }

    return truncateReply(lines.join('\n'));
}

function formatHealthDate(value?: Date | string | null): string {
    if (!value) return 'Never';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString();
}

function truncateHealthLine(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 180) return normalized;
    return `${normalized.slice(0, 177)}...`;
}
