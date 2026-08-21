import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import {
    DEFAULT_OUTPUT_LOCALE,
    resolveLocaleValue,
    type OutputLocaleValues,
} from '@zeffuro/fakegaming-common';
import { requireAdmin } from '../utils/permissions.js';
import { recordBotAuditEvent } from '../utils/audit.js';
import { createSlashCommand, getTestOnly, type LocalizedCommandMetadata } from './commandBuilder.js';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from './localization.js';
import { createBotTranslator, type BotMessages } from './localization.js';
import englishMessages from '../messages/en/subscriptions.json' with { type: 'json' };
import dutchMessages from '../messages/nl/subscriptions.json' with { type: 'json' };

export type SubscriptionCopyNamespace = 'bluesky' | 'tiktok' | 'twitch' | 'youtube';

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
    copyNamespace?: SubscriptionCopyNamespace;
    usernameOptionDescriptions?: OutputLocaleValues<string>;
    resolveOrVerify: (username: string) => Promise<{ ok: true; id: TId } | { ok: false }>;
    // Optional: check existence using only username/channel/guild before resolving (e.g., Twitch)
    checkExistingPre?: (args: { username: string; discordChannelId: string; guildId: string }) => Promise<boolean>;
    // Optional: check existence using resolved externalId (e.g., YouTube)
    checkExistingPost?: (args: { username: string; externalId: TId; discordChannelId: string; guildId: string }) => Promise<boolean>;
    addSubscription: (args: SubscriptionActionArgs<TId>) => Promise<void>;
    successMessages?: OutputLocaleValues<(args: { username: string; channelId: string }) => string>;
    alreadyConfiguredMessages?: OutputLocaleValues<(args: { username: string }) => string>;
    notFoundMessages?: OutputLocaleValues<(args: { username: string }) => string>;
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

    const sourceTranslator = createSubscriptionTranslator(DEFAULT_OUTPUT_LOCALE);
    const usernameDescription = opts.copyNamespace
        ? sourceTranslator(`${opts.copyNamespace}.usernameDescription`)
        : resolveLocaleValue(DEFAULT_OUTPUT_LOCALE, opts.usernameOptionDescriptions!);
    const data = createSlashCommand(meta, (b: SlashCommandBuilder) =>
        b
            .addStringOption((option) => {
                option.setName('username').setDescription(usernameDescription).setRequired(true);
                return option;
            })
            .addChannelOption((option) => {
                option.setName('channel').setDescription('Discord channel for notifications').setRequired(true);
                return option;
            })
            .addStringOption((option) => {
                option.setName('message').setDescription('Custom notification message (optional)').setRequired(false);
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
                const message = subscriptionMessage(opts, locale, 'alreadyConfigured', { username });
                await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
                return;
            }
        }

        let verified: { ok: true; id: TId } | { ok: false };
        try {
            verified = await opts.resolveOrVerify(username);
        } catch {
            const message = opts.verificationFailedMessages
                ? resolveLocaleValue(locale, opts.verificationFailedMessages)({ username })
                : createSubscriptionTranslator(locale)('verificationFailed', { username });
            await interaction.reply({content: message, flags: MessageFlags.Ephemeral});
            return;
        }
        if (!verified.ok) {
            const message = subscriptionMessage(opts, locale, 'notFound', { username });
            await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
            return;
        }
        const externalId = verified.id;

        if (opts.checkExistingPost) {
            const postExists = await opts.checkExistingPost({ username, externalId, discordChannelId: discordChannel.id, guildId });
            if (postExists) {
                const message = subscriptionMessage(opts, locale, 'alreadyConfigured', { username });
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
        await interaction.reply(subscriptionMessage(opts, locale, 'success', { username, channelId: discordChannel.id }));
    }

    const testOnly = Boolean(opts.testOnly ?? getTestOnly(meta));
    return { data, execute, testOnly };
}

function createSubscriptionTranslator(locale: SupportedOutputLocale) {
    const messages = resolveLocaleValue(locale, {
        en: englishMessages,
        nl: dutchMessages,
    } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    return createBotTranslator(locale, messages);
}

function subscriptionMessage<TId>(
    opts: CreateSubscriptionCommandOptions<TId>,
    locale: SupportedOutputLocale,
    key: 'success' | 'alreadyConfigured' | 'notFound',
    values: { username: string; channelId?: string },
): string {
    if (opts.copyNamespace) return createSubscriptionTranslator(locale)(`${opts.copyNamespace}.${key}`, values);
    if (key === 'success') return resolveLocaleValue(locale, opts.successMessages!)({ username: values.username, channelId: values.channelId! });
    if (key === 'alreadyConfigured') return resolveLocaleValue(locale, opts.alreadyConfiguredMessages!)({ username: values.username });
    return resolveLocaleValue(locale, opts.notFoundMessages!)({ username: values.username });
}
