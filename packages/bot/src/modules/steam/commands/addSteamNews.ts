import {
    AutocompleteInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { formatSteamStoreUrl, resolveSteamAppInput, searchSteamApps, type SteamAppSearchResult } from '@zeffuro/fakegaming-common/steam';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { recordBotAuditEvent } from '../../../utils/audit.js';
import { addSteamNews as META } from '../commands.manifest.js';

const MAX_SUGGESTIONS = 5;

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder
        .addStringOption((option) =>
            option
                .setName('game')
                .setDescription('Steam game name, App ID, or store URL')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Discord channel for Steam news')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('Custom notification message (optional)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (!(await requireAdmin(interaction))) return;

    const gameInput = interaction.options.getString('game', true);
    const discordChannel = interaction.options.getChannel('channel', true);
    const customMessage = interaction.options.getString('message', false) ?? undefined;

    const resolved = await resolveSteamAppInput(gameInput, { limit: MAX_SUGGESTIONS });
    if (resolved.status === 'not_found') {
        await interaction.reply({
            content: `I could not find a Steam app for \`${sanitizeInline(gameInput)}\`. Try a Steam store URL or App ID.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (resolved.status === 'ambiguous') {
        await interaction.reply({
            content: formatAmbiguousReply(gameInput, resolved.suggestions),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const app = resolved.app;
    const manager = getConfigManager().steamNewsSubscriptionManager;
    const existing = await manager.getOnePlain({
        steamAppId: app.steamAppId,
        discordChannelId: discordChannel.id,
        guildId,
    } as never);
    if (existing) {
        await interaction.reply({
            content: `Steam news for \`${sanitizeInline(app.appName)}\` is already configured in <#${discordChannel.id}>.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const created = await manager.addPlain({
        steamAppId: app.steamAppId,
        appName: app.appName,
        discordChannelId: discordChannel.id,
        guildId,
        customMessage,
    } as never) as { id?: number | string };

    await recordBotAuditEvent(interaction, {
        action: 'steamNewsSubscription.create',
        targetType: 'steamNewsSubscription',
        targetId: created.id ?? `${app.steamAppId}:${discordChannel.id}`,
        guildId,
        metadata: {
            channelId: discordChannel.id,
            steamAppId: app.steamAppId,
            appName: app.appName,
        },
    });

    await interaction.reply(
        `Subscribed <#${discordChannel.id}> to Steam news for \`${sanitizeInline(app.appName)}\` (${formatSteamStoreUrl(app.steamAppId)}).`
    );
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused().trim();
    if (focused.length < 2) {
        await interaction.respond([]);
        return;
    }

    try {
        const results = await searchSteamApps(focused, { limit: 10 });
        await interaction.respond(results.map(toAutocompleteChoice));
    } catch {
        await interaction.respond([]);
    }
}

function toAutocompleteChoice(result: SteamAppSearchResult): { name: string; value: string } {
    const name = `${result.appName} (${result.steamAppId})`;
    return {
        name: name.length <= 100 ? name : `${name.slice(0, 97)}...`,
        value: `steam:${result.steamAppId}`,
    };
}

function formatAmbiguousReply(input: string, suggestions: SteamAppSearchResult[]): string {
    const lines = suggestions.slice(0, MAX_SUGGESTIONS).map((suggestion) =>
        `- \`${suggestion.appName}\` (${suggestion.steamAppId})`
    );
    return [
        `Multiple Steam apps matched \`${sanitizeInline(input)}\`. Pick one from autocomplete or paste a Steam store URL/App ID.`,
        ...lines,
    ].join('\n');
}

function sanitizeInline(value: string): string {
    return value.replace(/`/g, "'");
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, autocomplete, testOnly };
