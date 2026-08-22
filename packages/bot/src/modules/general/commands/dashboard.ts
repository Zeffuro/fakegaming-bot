import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { dashboard as META } from '../commands.manifest.js';
import { getGeneralCopy } from '../data/generalCopy.js';

const LOCAL_DASHBOARD_URL = 'http://localhost:3000';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder.setDMPermission(false)
);

export function getDashboardGuildUrl(guildId: string): string | null {
    const configured = process.env.DASHBOARD_URL?.trim();
    const baseUrl = configured || (process.env.NODE_ENV === 'production' ? null : LOCAL_DASHBOARD_URL);
    if (!baseUrl) return null;

    try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        url.pathname = `${url.pathname.replace(/\/$/, '')}/dashboard/${encodeURIComponent(guildId)}`;
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale).dashboard;
    if (!interaction.guildId) {
        await interaction.reply({ content: copy.serverOnly, flags: MessageFlags.Ephemeral });
        return;
    }

    const url = getDashboardGuildUrl(interaction.guildId);
    if (!url) {
        await interaction.reply({ content: copy.notConfigured, flags: MessageFlags.Ephemeral });
        return;
    }

    const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel(copy.open)
            .setStyle(ButtonStyle.Link)
            .setURL(url),
    )];
    await interaction.reply({ content: copy.message, components });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
