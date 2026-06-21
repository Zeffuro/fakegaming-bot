import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../core/commandBuilder.js';
import {requireAdmin} from '../../utils/permissions.js';
import {recordBotAuditEvent} from '../../utils/audit.js';

const MAX_LISTED_RECORDS = 20;
const MAX_REPLY_LENGTH = 1900;

export interface IntegrationManagementRecord {
    id: number;
    guildId: string;
    discordChannelId: string;
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
}

/**
 * Creates a guild-admin-only slash command for listing and removing integration configs.
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
    const lines = visibleRecords.map((record) => opts.formatRecord(record));
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

async function replyEphemeral(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    await interaction.reply({content, flags: MessageFlags.Ephemeral});
}

function truncateReply(content: string): string {
    if (content.length <= MAX_REPLY_LENGTH) return content;
    const truncated = content.slice(0, MAX_REPLY_LENGTH - 13).trimEnd();
    return `${truncated}\n...truncated`;
}
