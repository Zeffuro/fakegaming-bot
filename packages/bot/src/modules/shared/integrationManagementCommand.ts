import { runtimeText } from '../../core/runtimeCopy.js';
import {
    DEFAULT_OUTPUT_LOCALE,
    resolveLocaleValue,
    type IntegrationHealthRecord,
    type IntegrationHealthStatus,
    type OutputLocaleValues,
} from '@zeffuro/fakegaming-common';
import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly, type LocalizedCommandMetadata} from '../../core/commandBuilder.js';
import {requireAdmin} from '../../utils/permissions.js';
import {recordBotAuditEvent} from '../../utils/audit.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../core/localization.js';

const MAX_LISTED_RECORDS = 20;
const MAX_REPLY_LENGTH = 1900;

interface LocalizableBuilder {
    setName(name: string): unknown;
    setDescription(description: string): unknown;
}

interface LocalizedBuilderCopy {
    name: string;
    description: string;
}

function applyLocalizedBuilderCopy<T extends LocalizableBuilder>(
    builder: T,
    copy: LocalizedBuilderCopy,
): T {
    builder.setName(copy.name);
    builder.setDescription(copy.description);
    return builder;
}

export interface IntegrationManagementRecord {
    id: number;
    guildId: string;
    discordChannelId: string;
    paused?: boolean | null;
}

export interface IntegrationManagementCommandOptions<TRecord extends IntegrationManagementRecord> {
    meta: LocalizedCommandMetadata & {testOnly?: boolean};
    subjectKey?: IntegrationSubjectKey;
    subjects?: {
        singular: OutputLocaleValues<string>;
        plural: OutputLocaleValues<string>;
    };
    listRecords: (guildId: string) => Promise<TRecord[]>;
    getRecord: (id: number) => Promise<TRecord | null>;
    removeRecord: (id: number) => Promise<void>;
    formatRecord: (record: TRecord, locale?: SupportedOutputLocale) => string;
    describeRecord: (record: TRecord, locale: SupportedOutputLocale) => string;
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

type IntegrationSubjectKey = 'bluesky' | 'tiktok' | 'twitch' | 'youtube' | 'steam' | 'patchnotes';

/**
 * Creates a guild-admin-only slash command for listing, removing, pausing, and resuming integration configs.
 */
export function createIntegrationManagementCommand<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>
) {
    const defaultSubjectSingular = subjectSingular(opts, DEFAULT_OUTPUT_LOCALE);
    const defaultSubjectPlural = subjectPlural(opts, DEFAULT_OUTPUT_LOCALE);
    const idCopy = {name: 'id', description: `Configuration ID from ${opts.meta.name} list`};
    const data = createSlashCommand(opts.meta, (builder: SlashCommandBuilder) => {
        builder
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((subcommand) => applyLocalizedBuilderCopy(subcommand, {
                name: 'list', description: `List configured ${defaultSubjectPlural}`,
            }))
            .addSubcommand((subcommand) => {
                applyLocalizedBuilderCopy(subcommand, {
                    name: 'remove', description: `Remove a configured ${defaultSubjectSingular}`,
                });
                return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
            });
        if (opts.setPausedRecord) {
            builder
                .addSubcommand((subcommand) => {
                    applyLocalizedBuilderCopy(subcommand, {
                        name: 'pause', description: `Pause notifications for a configured ${defaultSubjectSingular}`,
                    });
                    return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
                })
                .addSubcommand((subcommand) => {
                    applyLocalizedBuilderCopy(subcommand, {
                        name: 'resume', description: `Resume notifications for a configured ${defaultSubjectSingular}`,
                    });
                    return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
                });
        }
        if (opts.health) {
            builder.addSubcommand((subcommand) => {
                applyLocalizedBuilderCopy(subcommand, {
                    name: 'test', description: `Show latest health for a configured ${defaultSubjectSingular}`,
                });
                return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
            });
        }
    });

    async function execute(interaction: ChatInputCommandInteraction) {
        const locale = await resolveInteractionOutputLocale(interaction);
        const guildId = interaction.guildId;
        if (!guildId) {
            await replyEphemeral(interaction, runtimeText(locale, 'shared', 'serverOnly'));
            return;
        }

        if (!(await requireAdmin(interaction))) return;

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') {
            await listRecords(interaction, guildId, opts, locale);
            return;
        }

        if (subcommand === 'remove') {
            await removeRecord(interaction, guildId, opts, locale);
            return;
        }

        if (subcommand === 'pause') {
            await setPausedRecord(interaction, guildId, opts, true, locale);
            return;
        }

        if (subcommand === 'resume') {
            await setPausedRecord(interaction, guildId, opts, false, locale);
            return;
        }

        if (subcommand === 'test') {
            await reportHealth(interaction, guildId, opts, locale);
            return;
        }

        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'unknownManagementAction', {subject: subjectSingular(opts, locale)}));
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
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): Promise<void> {
    const records = await opts.listRecords(guildId);
    if (records.length === 0) {
        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'noneConfigured', {subjects: subjectPlural(opts, locale)}));
        return;
    }

    const visibleRecords = records.slice(0, MAX_LISTED_RECORDS);
    const lines = visibleRecords.map((record) => {
        const state = record.paused ? runtimeText(locale, 'shared', 'pausedSuffix') : '';
        return `${opts.formatRecord(record, locale)}${state}`;
    });
    const hiddenCount = records.length - visibleRecords.length;
    if (hiddenCount > 0) {
        lines.push(runtimeText(locale, 'shared', 'showingFirstMoreNotShown', {limit: MAX_LISTED_RECORDS, hiddenCount}));
    }

    const content = truncateReply([
        runtimeText(locale, 'shared', 'configuredHeading', {subjects: subjectPlural(opts, locale)}),
        ...lines,
    ].join('\n'), locale);
    await replyEphemeral(interaction, content);
}

async function removeRecord<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): Promise<void> {
    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyNotFound(interaction, opts, locale);
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
    const subject = subjectSingular(opts, locale);
    await replyEphemeral(interaction, runtimeText(locale, 'shared', 'removed', {
        removedSubject: locale === 'nl' ? capitalizeNl(subject) : subject,
        description: opts.describeRecord(record, locale),
    }));
}

async function setPausedRecord<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>,
    paused: boolean,
    locale: SupportedOutputLocale,
): Promise<void> {
    if (!opts.setPausedRecord) {
        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'cannotChangeState', {subject: subjectSingular(opts, locale), paused: String(paused)}));
        return;
    }

    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyNotFound(interaction, opts, locale);
        return;
    }

    if (Boolean(record.paused) === paused) {
        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'alreadyState', {
            subject: subjectSingular(opts, locale), description: opts.describeRecord(record, locale), paused: String(paused),
        }));
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
    await replyEphemeral(interaction, runtimeText(locale, 'shared', 'stateChanged', {
        subject: subjectSingular(opts, locale), description: opts.describeRecord(record, locale), paused: String(paused),
    }));
}

async function reportHealth<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): Promise<void> {
    if (!opts.health) {
        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'noHealthChecks', {subject: subjectSingular(opts, locale)}));
        return;
    }

    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyNotFound(interaction, opts, locale);
        return;
    }

    const integrationHealthManager = getIntegrationHealthManager();
    if (typeof integrationHealthManager.getForConfig !== 'function') {
        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'healthUnavailable', {subject: subjectSingular(opts, locale), description: opts.describeRecord(record, locale)}));
        return;
    }

    let health: IntegrationHealthRecord | null;
    try {
        health = await integrationHealthManager.getForConfig(opts.health.provider, id);
    } catch {
        await replyEphemeral(interaction, runtimeText(locale, 'shared', 'healthLoadFailed', {subject: subjectSingular(opts, locale), description: opts.describeRecord(record, locale)}));
        return;
    }

    if (!health) {
        await replyEphemeral(
            interaction,
            runtimeText(locale, 'shared', 'noHealthRecord', {subject: subjectSingular(opts, locale), description: opts.describeRecord(record, locale)})
        );
        return;
    }

    await replyEphemeral(interaction, formatHealthReply(subjectSingular(opts, locale), opts.describeRecord(record, locale), health, locale));
}

async function replyEphemeral(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    await interaction.reply({content, flags: MessageFlags.Ephemeral});
}

function truncateReply(content: string, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (content.length <= MAX_REPLY_LENGTH) return content;
    const truncated = content.slice(0, MAX_REPLY_LENGTH - 13).trimEnd();
    return `${truncated}\n...${runtimeText(locale, "shared", "truncated")}`;
}

function subjectSingular<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): string {
    if (opts.subjectKey) return runtimeText(locale, 'shared', SUBJECT_KEYS[opts.subjectKey].singular);
    if (opts.subjects) return resolveLocaleValue(locale, opts.subjects.singular);
    throw new Error('Integration management commands require subjectKey or subjects.');
}

function subjectPlural<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): string {
    if (opts.subjectKey) return runtimeText(locale, 'shared', SUBJECT_KEYS[opts.subjectKey].plural);
    if (opts.subjects) return resolveLocaleValue(locale, opts.subjects.plural);
    throw new Error('Integration management commands require subjectKey or subjects.');
}

const SUBJECT_KEYS = {
    bluesky: {singular: 'subjectBlueskySingular', plural: 'subjectBlueskyPlural'},
    tiktok: {singular: 'subjectTikTokSingular', plural: 'subjectTikTokPlural'},
    twitch: {singular: 'subjectTwitchSingular', plural: 'subjectTwitchPlural'},
    youtube: {singular: 'subjectYouTubeSingular', plural: 'subjectYouTubePlural'},
    steam: {singular: 'subjectSteamSingular', plural: 'subjectSteamPlural'},
    patchnotes: {singular: 'subjectPatchnotesSingular', plural: 'subjectPatchnotesPlural'},
} as const;

async function replyNotFound<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): Promise<void> {
    await replyEphemeral(interaction, runtimeText(locale, 'shared', 'notFound', {subject: subjectSingular(opts, locale)}));
}

function capitalizeNl(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
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

function formatHealthReply(
    subjectSingular: string,
    recordDescription: string,
    health: IntegrationHealthRecord,
    locale: SupportedOutputLocale,
): string {
    const lines = [
        runtimeText(locale, 'shared', 'latestHealthFor', {subject: subjectSingular, description: recordDescription}),
        `${runtimeText(locale, 'shared', 'healthStatus')}: ${inlineCode(formatHealthStatus(health.status, locale))}`,
        `${runtimeText(locale, 'shared', 'healthLastChecked')}: ${formatHealthDate(health.lastCheckedAt, locale)}`,
        `${runtimeText(locale, 'shared', 'healthLastSuccess')}: ${formatHealthDate(health.lastSuccessAt, locale)}`,
        `${runtimeText(locale, 'shared', 'healthLastFailure')}: ${formatHealthDate(health.lastFailureAt, locale)}`,
        `${runtimeText(locale, 'shared', 'healthLastDelivery')}: ${formatHealthDate(health.lastDeliveryAt, locale)}`,
        `${runtimeText(locale, 'shared', 'healthConsecutiveFailures')}: ${health.consecutiveFailures}`,
    ];

    if (health.lastErrorCode || health.lastErrorMessage) {
        const code = health.lastErrorCode ? `${inlineCode(health.lastErrorCode)} ` : '';
        lines.push(`${runtimeText(locale, 'shared', 'healthLastError')}: ${code}${truncateHealthLine(health.lastErrorMessage ?? runtimeText(locale, 'shared', 'healthUnknownError'))}`);
    }

    return truncateReply(lines.join('\n'), locale);
}

function formatHealthDate(value: Date | string | null | undefined, locale: SupportedOutputLocale): string {
    if (!value) return runtimeText(locale, 'shared', 'healthNever');
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString();
}

function formatHealthStatus(status: string, locale: SupportedOutputLocale): string {
    const key = HEALTH_STATUS_KEYS[status];
    return key ? runtimeText(locale, 'shared', key) : status;
}

const HEALTH_STATUS_KEYS: Readonly<Record<string, 'healthStatusHealthy' | 'healthStatusSuccess' | 'healthStatusWarning' | 'healthStatusError' | 'healthStatusFailed' | 'healthStatusPaused' | 'healthStatusUnknown'>> = {
    healthy: 'healthStatusHealthy', success: 'healthStatusSuccess', warning: 'healthStatusWarning', error: 'healthStatusError',
    failed: 'healthStatusFailed', paused: 'healthStatusPaused', unknown: 'healthStatusUnknown',
};

function truncateHealthLine(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 180) return normalized;
    return `${normalized.slice(0, 177)}...`;
}
