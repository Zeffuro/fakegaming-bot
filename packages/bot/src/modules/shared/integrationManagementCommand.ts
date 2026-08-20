import {
    DEFAULT_OUTPUT_LOCALE,
    NON_DEFAULT_OUTPUT_LOCALES,
    resolveLocaleValue,
    type IntegrationHealthRecord,
    type IntegrationHealthStatus,
    type NonDefaultOutputLocale,
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
    setNameLocalization(locale: NonDefaultOutputLocale, name: string | null): unknown;
    setDescriptionLocalization(locale: NonDefaultOutputLocale, description: string | null): unknown;
}

interface LocalizedBuilderCopy {
    name: string;
    description: string;
}

function applyLocalizedBuilderCopy<T extends LocalizableBuilder>(
    builder: T,
    values: OutputLocaleValues<LocalizedBuilderCopy>,
): T {
    const defaultCopy = resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, values);
    builder.setName(defaultCopy.name);
    builder.setDescription(defaultCopy.description);
    for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
        const copy = resolveLocaleValue(locale, values);
        builder.setNameLocalization(locale, copy.name);
        builder.setDescriptionLocalization(locale, copy.description);
    }
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
    subjects: {
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

/**
 * Creates a guild-admin-only slash command for listing, removing, pausing, and resuming integration configs.
 */
export function createIntegrationManagementCommand<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>
) {
    const defaultSubjectSingular = resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, opts.subjects.singular);
    const defaultSubjectPlural = resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, opts.subjects.plural);
    const dutchSubjectSingular = resolveLocaleValue('nl', opts.subjects.singular);
    const dutchSubjectPlural = resolveLocaleValue('nl', opts.subjects.plural);
    const localizedCommandName = opts.meta.localizations?.['nl']?.name ?? opts.meta.name;
    const idCopy = {
        en: {name: 'id', description: `Configuration ID from ${opts.meta.name} list`},
        nl: {name: 'id', description: `Configuratie-ID uit de lijst van ${localizedCommandName}`},
    } satisfies OutputLocaleValues<LocalizedBuilderCopy>;
    const data = createSlashCommand(opts.meta, (builder: SlashCommandBuilder) => {
        builder
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((subcommand) => applyLocalizedBuilderCopy(subcommand, {
                en: {name: 'list', description: `List configured ${defaultSubjectPlural}`},
                nl: {name: 'lijst', description: `Toon ingestelde ${dutchSubjectPlural}`},
            }))
            .addSubcommand((subcommand) => {
                applyLocalizedBuilderCopy(subcommand, {
                    en: {name: 'remove', description: `Remove a configured ${defaultSubjectSingular}`},
                    nl: {name: 'verwijderen', description: `Verwijder een ingesteld ${dutchSubjectSingular}`},
                });
                return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
            });
        if (opts.setPausedRecord) {
            builder
                .addSubcommand((subcommand) => {
                    applyLocalizedBuilderCopy(subcommand, {
                        en: {name: 'pause', description: `Pause notifications for a configured ${defaultSubjectSingular}`},
                        nl: {name: 'pauzeren', description: `Pauzeer meldingen voor een ingesteld ${dutchSubjectSingular}`},
                    });
                    return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
                })
                .addSubcommand((subcommand) => {
                    applyLocalizedBuilderCopy(subcommand, {
                        en: {name: 'resume', description: `Resume notifications for a configured ${defaultSubjectSingular}`},
                        nl: {name: 'hervatten', description: `Hervat meldingen voor een ingesteld ${dutchSubjectSingular}`},
                    });
                    return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
                });
        }
        if (opts.health) {
            builder.addSubcommand((subcommand) => {
                applyLocalizedBuilderCopy(subcommand, {
                    en: {name: 'test', description: `Show latest health for a configured ${defaultSubjectSingular}`},
                    nl: {name: 'status', description: `Toon de laatste status van een ingesteld ${dutchSubjectSingular}`},
                });
                return subcommand.addIntegerOption(option => applyLocalizedBuilderCopy(option, idCopy).setRequired(true));
            });
        }
    });

    async function execute(interaction: ChatInputCommandInteraction) {
        const locale = await resolveInteractionOutputLocale(interaction);
        const guildId = interaction.guildId;
        if (!guildId) {
            await replyEphemeral(interaction, localize(locale, { en: 'This command can only be used in a server.', nl: 'Deze opdracht kan alleen op een server worden gebruikt.' }));
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

        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `Unknown ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} management action.`, nl: `Onbekende beheeractie voor ${subjectSingular(opts, locale)}.` }));
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
        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `No ${subjectPlural(opts, DEFAULT_OUTPUT_LOCALE)} are configured for this server.`, nl: `Er zijn geen ${subjectPlural(opts, locale)} ingesteld voor deze server.` }));
        return;
    }

    const visibleRecords = records.slice(0, MAX_LISTED_RECORDS);
    const lines = visibleRecords.map((record) => {
        const state = record.paused ? localize(locale, { en: ' paused', nl: ' gepauzeerd' }) : '';
        return `${opts.formatRecord(record, locale)}${state}`;
    });
    const hiddenCount = records.length - visibleRecords.length;
    if (hiddenCount > 0) {
        lines.push(resolveLocaleValue(locale, { en: `Showing first ${MAX_LISTED_RECORDS}; ${hiddenCount} more not shown.`, nl: `De eerste ${MAX_LISTED_RECORDS} worden getoond; ${hiddenCount} niet getoond.` }));
    }

    const content = truncateReply([
        resolveLocaleValue(locale, { en: `Configured ${subjectPlural(opts, DEFAULT_OUTPUT_LOCALE)}:`, nl: `Ingestelde ${subjectPlural(opts, locale)}:` }),
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
    await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `Removed ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} ${opts.describeRecord(record, locale)}.`, nl: `${capitalizeNl(subjectSingular(opts, locale))} ${opts.describeRecord(record, locale)} verwijderd.` }));
}

async function setPausedRecord<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>,
    paused: boolean,
    locale: SupportedOutputLocale,
): Promise<void> {
    if (!opts.setPausedRecord) {
        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `That ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} cannot be ${paused ? 'paused' : 'resumed'}.`, nl: `Dat ${subjectSingular(opts, locale)} kan niet worden ${paused ? 'gepauzeerd' : 'hervat'}.` }));
        return;
    }

    const id = interaction.options.getInteger('id', true);
    const record = await opts.getRecord(id);
    if (!record || record.guildId !== guildId) {
        await replyNotFound(interaction, opts, locale);
        return;
    }

    if (Boolean(record.paused) === paused) {
        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `That ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} ${opts.describeRecord(record, locale)} is already ${paused ? 'paused' : 'active'}.`, nl: `Dat ${subjectSingular(opts, locale)} ${opts.describeRecord(record, locale)} is al ${paused ? 'gepauzeerd' : 'actief'}.` }));
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
    await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `${capitalizeAction(paused)}d ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} ${opts.describeRecord(record, locale)}.`, nl: `${subjectSingular(opts, locale)} ${opts.describeRecord(record, locale)} ${paused ? 'gepauzeerd' : 'hervat'}.` }));
}

async function reportHealth<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): Promise<void> {
    if (!opts.health) {
        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `That ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} does not have health checks configured.`, nl: `Voor dat ${subjectSingular(opts, locale)} zijn geen statuscontroles ingesteld.` }));
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
        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `Health data is not available for ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} ${opts.describeRecord(record, locale)}.`, nl: `Statusgegevens zijn niet beschikbaar voor ${subjectSingular(opts, locale)} ${opts.describeRecord(record, locale)}.` }));
        return;
    }

    let health: IntegrationHealthRecord | null;
    try {
        health = await integrationHealthManager.getForConfig(opts.health.provider, id);
    } catch {
        await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `Health data could not be loaded for ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} ${opts.describeRecord(record, locale)}.`, nl: `Statusgegevens konden niet worden geladen voor ${subjectSingular(opts, locale)} ${opts.describeRecord(record, locale)}.` }));
        return;
    }

    if (!health) {
        await replyEphemeral(
            interaction,
            resolveLocaleValue(locale, { en: `No health record has been recorded yet for ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} ${opts.describeRecord(record, locale)}. The next worker poll will populate it.`, nl: `Er is nog geen status vastgelegd voor ${subjectSingular(opts, locale)} ${opts.describeRecord(record, locale)}. De volgende controle vult deze in.` })
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
    return `${truncated}\n...${resolveLocaleValue(locale, { en: 'truncated', nl: 'afgekapt' })}`;
}

function localize(locale: SupportedOutputLocale, values: OutputLocaleValues<string>): string {
    return resolveLocaleValue(locale, values);
}

function subjectSingular<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): string {
    return resolveLocaleValue(locale, opts.subjects.singular);
}

function subjectPlural<TRecord extends IntegrationManagementRecord>(
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): string {
    return resolveLocaleValue(locale, opts.subjects.plural);
}

async function replyNotFound<TRecord extends IntegrationManagementRecord>(
    interaction: ChatInputCommandInteraction,
    opts: IntegrationManagementCommandOptions<TRecord>,
    locale: SupportedOutputLocale,
): Promise<void> {
    await replyEphemeral(interaction, resolveLocaleValue(locale, { en: `That ${subjectSingular(opts, DEFAULT_OUTPUT_LOCALE)} was not found in this server.`, nl: `Dat ${subjectSingular(opts, locale)} is niet gevonden op deze server.` }));
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

function formatHealthReply(
    subjectSingular: string,
    recordDescription: string,
    health: IntegrationHealthRecord,
    locale: SupportedOutputLocale,
): string {
    const lines = [
        resolveLocaleValue(locale, { en: `Latest health for ${subjectSingular} ${recordDescription}:`, nl: `Laatste status voor ${subjectSingular} ${recordDescription}:` }),
        `${localize(locale, { en: 'Status', nl: 'Status' })}: ${inlineCode(formatHealthStatus(health.status, locale))}`,
        `${localize(locale, { en: 'Last checked', nl: 'Laatst gecontroleerd' })}: ${formatHealthDate(health.lastCheckedAt, locale)}`,
        `${localize(locale, { en: 'Last success', nl: 'Laatste succes' })}: ${formatHealthDate(health.lastSuccessAt, locale)}`,
        `${localize(locale, { en: 'Last failure', nl: 'Laatste fout' })}: ${formatHealthDate(health.lastFailureAt, locale)}`,
        `${localize(locale, { en: 'Last delivery', nl: 'Laatst afgeleverd' })}: ${formatHealthDate(health.lastDeliveryAt, locale)}`,
        `${localize(locale, { en: 'Consecutive failures', nl: 'Opeenvolgende fouten' })}: ${health.consecutiveFailures}`,
    ];

    if (health.lastErrorCode || health.lastErrorMessage) {
        const code = health.lastErrorCode ? `${inlineCode(health.lastErrorCode)} ` : '';
        lines.push(`${localize(locale, { en: 'Last error', nl: 'Laatste foutmelding' })}: ${code}${truncateHealthLine(health.lastErrorMessage ?? localize(locale, { en: 'Unknown error', nl: 'Onbekende fout' }))}`);
    }

    return truncateReply(lines.join('\n'), locale);
}

function formatHealthDate(value: Date | string | null | undefined, locale: SupportedOutputLocale): string {
    if (!value) return localize(locale, { en: 'Never', nl: 'Nooit' });
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString();
}

function formatHealthStatus(status: string, locale: SupportedOutputLocale): string {
    const labels: Readonly<Record<string, string>> = resolveLocaleValue(locale, {
        en: {},
        nl: {
            healthy: 'gezond', success: 'geslaagd', warning: 'waarschuwing', error: 'fout', failed: 'mislukt',
            paused: 'gepauzeerd', unknown: 'onbekend',
        },
    } satisfies OutputLocaleValues<Readonly<Record<string, string>>>);
    return labels[status] ?? status;
}

function truncateHealthLine(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 180) return normalized;
    return `${normalized.slice(0, 177)}...`;
}
