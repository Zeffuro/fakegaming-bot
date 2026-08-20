import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import {
    DEFAULT_OUTPUT_LOCALE,
    NON_DEFAULT_OUTPUT_LOCALES,
    resolveLocaleValue,
    type OutputLocaleValues,
} from '@zeffuro/fakegaming-common';
import { requireAdmin } from '../utils/permissions.js';
import { recordBotAuditEvent } from '../utils/audit.js';
import { createSlashCommand, getTestOnly, type LocalizedCommandMetadata } from './commandBuilder.js';
import { resolveInteractionOutputLocale } from './localization.js';

export interface SubscriptionActionArgs<TId> {
    username: string;
    externalId: TId;
    discordChannelId: string;
    guildId: string;
    customMessage?: string;
}

export interface SubscriptionAuditOptions<TId> {
    action: string;
    targetType: string;
    targetId: (args: SubscriptionActionArgs<TId>) => string | number | null;
    metadata?: (args: SubscriptionActionArgs<TId>) => Record<string, unknown>;
}

export interface CreateSubscriptionCommandOptions<TId> {
    // Prefer meta from module manifest
    meta?: LocalizedCommandMetadata & {testOnly?: boolean};
    // Back-compat: explicit name/description (will be ignored if meta provided)
    commandName?: string;
    description?: string;
    usernameOptionDescriptions: OutputLocaleValues<string>;
    resolveOrVerify: (username: string) => Promise<{ ok: true; id: TId } | { ok: false }>;
    // Optional: check existence using only username/channel/guild before resolving (e.g., Twitch)
    checkExistingPre?: (args: { username: string; discordChannelId: string; guildId: string }) => Promise<boolean>;
    // Optional: check existence using resolved externalId (e.g., YouTube)
    checkExistingPost?: (args: { username: string; externalId: TId; discordChannelId: string; guildId: string }) => Promise<boolean>;
    addSubscription: (args: SubscriptionActionArgs<TId>) => Promise<void>;
    successMessages: OutputLocaleValues<(args: { username: string; channelId: string }) => string>;
    alreadyConfiguredMessages: OutputLocaleValues<(args: { username: string }) => string>;
    notFoundMessages: OutputLocaleValues<(args: { username: string }) => string>;
    verificationFailedMessages?: OutputLocaleValues<(args: { username: string }) => string>;
    auditAdd?: SubscriptionAuditOptions<TId>;
    testOnly?: boolean;
}

/**
 * Create a standard guild-admin-only subscription command with common options (username, channel, message)
 * and shared execute plumbing with optional pre/post existence checks.
 */
export function createSubscriptionCommand<TId>(opts: CreateSubscriptionCommandOptions<TId>) {
    const meta = opts.meta ?? (opts.commandName && opts.description ? { name: opts.commandName, description: opts.description } : null);
    if (!meta) {
        throw new Error('createSubscriptionCommand: either opts.meta or opts.commandName/opts.description must be provided');
    }

    const optionCopy = {
        en: {
            usernameName: 'username', usernameDescription: resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, opts.usernameOptionDescriptions),
            channelName: 'channel', channelDescription: 'Discord channel for notifications',
            messageName: 'message', messageDescription: 'Custom notification message (optional)',
        },
        nl: {
            usernameName: 'gebruikersnaam', usernameDescription: resolveLocaleValue('nl', opts.usernameOptionDescriptions),
            channelName: 'kanaal', channelDescription: 'Discord-kanaal voor meldingen',
            messageName: 'bericht', messageDescription: 'Aangepast meldingsbericht (optioneel)',
        },
    } satisfies OutputLocaleValues<{
        usernameName: string; usernameDescription: string;
        channelName: string; channelDescription: string;
        messageName: string; messageDescription: string;
    }>;
    const defaultCopy = resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, optionCopy);
    const data = createSlashCommand(meta, (b: SlashCommandBuilder) =>
        b
            .addStringOption((option) => {
                option.setName(defaultCopy.usernameName).setDescription(defaultCopy.usernameDescription).setRequired(true);
                for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
                    const copy = resolveLocaleValue(locale, optionCopy);
                    option.setNameLocalization(locale, copy.usernameName).setDescriptionLocalization(locale, copy.usernameDescription);
                }
                return option;
            })
            .addChannelOption((option) => {
                option.setName(defaultCopy.channelName).setDescription(defaultCopy.channelDescription).setRequired(true);
                for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
                    const copy = resolveLocaleValue(locale, optionCopy);
                    option.setNameLocalization(locale, copy.channelName).setDescriptionLocalization(locale, copy.channelDescription);
                }
                return option;
            })
            .addStringOption((option) => {
                option.setName(defaultCopy.messageName).setDescription(defaultCopy.messageDescription).setRequired(false);
                for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
                    const copy = resolveLocaleValue(locale, optionCopy);
                    option.setNameLocalization(locale, copy.messageName).setDescriptionLocalization(locale, copy.messageDescription);
                }
                return option;
            })
    ).setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    async function execute(interaction: ChatInputCommandInteraction) {
        const locale = await resolveInteractionOutputLocale(interaction);
        if (!(await requireAdmin(interaction))) return;

        const username = interaction.options.getString('username', true);
        const discordChannel = interaction.options.getChannel('channel', true);
        const customMessage = interaction.options.getString('message', false) ?? undefined;
        const guildId = interaction.guildId!;

        if (opts.checkExistingPre) {
            const preExists = await opts.checkExistingPre({ username, discordChannelId: discordChannel.id, guildId });
            if (preExists) {
                const message = resolveLocaleValue(locale, opts.alreadyConfiguredMessages)({ username });
                await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
                return;
            }
        }

        let verified: { ok: true; id: TId } | { ok: false };
        try {
            verified = await opts.resolveOrVerify(username);
        } catch {
            const message = resolveLocaleValue(locale, opts.verificationFailedMessages ?? {
                en: ({ username: value }) => `Failed to verify account \`${value}\`. Please try again later.`,
                nl: ({ username: value }) => `Account \`${value}\` controleren is mislukt. Probeer het later opnieuw.`,
            })({ username });
            await interaction.reply({content: message, flags: MessageFlags.Ephemeral});
            return;
        }
        if (!verified.ok) {
            const message = resolveLocaleValue(locale, opts.notFoundMessages)({ username });
            await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
            return;
        }
        const externalId = verified.id;

        if (opts.checkExistingPost) {
            const postExists = await opts.checkExistingPost({ username, externalId, discordChannelId: discordChannel.id, guildId });
            if (postExists) {
                const message = resolveLocaleValue(locale, opts.alreadyConfiguredMessages)({ username });
                await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const actionArgs = { username, externalId, discordChannelId: discordChannel.id, guildId, customMessage };
        await opts.addSubscription(actionArgs);
        if (opts.auditAdd) {
            await recordBotAuditEvent(interaction, {
                action: opts.auditAdd.action,
                targetType: opts.auditAdd.targetType,
                targetId: opts.auditAdd.targetId(actionArgs),
                guildId,
                metadata: opts.auditAdd.metadata?.(actionArgs) ?? null,
            });
        }
        await interaction.reply(resolveLocaleValue(locale, opts.successMessages)({ username, channelId: discordChannel.id }));
    }

    const testOnly = Boolean(opts.testOnly ?? getTestOnly(meta));
    return { data, execute, testOnly };
}
