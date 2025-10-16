import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../utils/permissions.js';
import { createSlashCommand, getTestOnly } from './commandBuilder.js';

export interface CreateSubscriptionCommandOptions<TId> {
    // Prefer meta from module manifest
    meta?: { name: string; description: string; testOnly?: boolean };
    // Back-compat: explicit name/description (will be ignored if meta provided)
    commandName?: string;
    description?: string;
    usernameOptionDescription: string;
    resolveOrVerify: (username: string) => Promise<{ ok: true; id: TId } | { ok: false }>;
    // Optional: check existence using only username/channel/guild before resolving (e.g., Twitch)
    checkExistingPre?: (args: { username: string; discordChannelId: string; guildId: string }) => Promise<boolean>;
    // Optional: check existence using resolved externalId (e.g., YouTube)
    checkExistingPost?: (args: { username: string; externalId: TId; discordChannelId: string; guildId: string }) => Promise<boolean>;
    addSubscription: (args: { username: string; externalId: TId; discordChannelId: string; guildId: string; customMessage?: string }) => Promise<void>;
    successMessage: (args: { username: string; channelId: string }) => string;
    alreadyConfiguredMessage: (args: { username: string }) => string;
    notFoundMessage: (args: { username: string }) => string;
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

    const data = createSlashCommand(meta, (b: SlashCommandBuilder) =>
        b
            .addStringOption((option) =>
                option.setName('username').setDescription(opts.usernameOptionDescription).setRequired(true)
            )
            .addChannelOption((option) =>
                option.setName('channel').setDescription('Discord channel for notifications').setRequired(true)
            )
            .addStringOption((option) =>
                option.setName('message').setDescription('Custom notification message (optional)').setRequired(false)
            )
    ).setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    async function execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireAdmin(interaction))) return;

        const username = interaction.options.getString('username', true);
        const discordChannel = interaction.options.getChannel('channel', true);
        const customMessage = interaction.options.getString('message', false) ?? undefined;
        const guildId = interaction.guildId!;

        if (opts.checkExistingPre) {
            const preExists = await opts.checkExistingPre({ username, discordChannelId: discordChannel.id, guildId });
            if (preExists) {
                await interaction.reply({ content: opts.alreadyConfiguredMessage({ username }), flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const verified = await opts.resolveOrVerify(username);
        if (!verified.ok) {
            await interaction.reply({ content: opts.notFoundMessage({ username }), flags: MessageFlags.Ephemeral });
            return;
        }
        const externalId = verified.id;

        if (opts.checkExistingPost) {
            const postExists = await opts.checkExistingPost({ username, externalId, discordChannelId: discordChannel.id, guildId });
            if (postExists) {
                await interaction.reply({ content: opts.alreadyConfiguredMessage({ username }), flags: MessageFlags.Ephemeral });
                return;
            }
        }

        await opts.addSubscription({ username, externalId, discordChannelId: discordChannel.id, guildId, customMessage });
        await interaction.reply(opts.successMessage({ username, channelId: discordChannel.id }));
    }

    const testOnly = Boolean(opts.testOnly ?? getTestOnly(meta));
    return { data, execute, testOnly };
}
