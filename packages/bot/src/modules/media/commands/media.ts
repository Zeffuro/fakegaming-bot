import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { runtimeText } from '../../../core/runtimeCopy.js';
import {
    getTmdbMedia,
    searchTmdbMedia,
    TmdbAuthenticationError,
    TmdbConfigurationError,
    type TmdbMediaType,
    type TmdbSearchType,
} from '../../../services/tmdbService.js';
import { media as META } from '../commands.manifest.js';
import {
    buildTmdbMediaEmbed,
    buildTmdbSearchEmbed,
    formatTmdbAutocompleteName,
} from '../shared/mediaPresentation.js';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) => builder
    .addSubcommand(subcommand => subcommand
        .setName('search')
        .setDescription('Search TMDB for a movie or TV show')
        .addStringOption(option => option
            .setName('query')
            .setDescription('Movie or TV show title')
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(100)
            .setAutocomplete(true))
        .addStringOption(option => option
            .setName('type')
            .setDescription('Limit results to movies or TV shows')
            .setRequired(false)
            .addChoices(
                { name: 'All', value: 'all' },
                { name: 'Movies', value: 'movie' },
                { name: 'TV shows', value: 'tv' },
            )))
);

export function encodeTmdbChoice(type: TmdbMediaType, id: number): string {
    return `tmdb:${type}:${id}`;
}

export function parseTmdbChoice(value: string): { type: TmdbMediaType; id: number } | null {
    const match = /^tmdb:(movie|tv):(\d+)$/.exec(value.trim());
    if (!match) return null;
    const id = Number(match[2]);
    return Number.isSafeInteger(id) && id > 0 ? { type: match[1] as TmdbMediaType, id } : null;
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const query = interaction.options.getString('query', true);
    const selected = parseTmdbChoice(query);

    try {
        if (selected) {
            const media = await getTmdbMedia(selected.type, selected.id, locale);
            if (!media) {
                await interaction.reply({ content: runtimeText(locale, 'media', 'noResults', { query }), flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.reply({ embeds: [buildTmdbMediaEmbed(media, locale)] });
            return;
        }

        const type = parseSearchType(interaction.options.getString('type', false));
        const results = await searchTmdbMedia(query, type, locale);
        await interaction.reply({
            embeds: [buildTmdbSearchEmbed(results, query, locale)],
            flags: results.length ? undefined : MessageFlags.Ephemeral,
        });
    } catch (error) {
        const key = error instanceof TmdbConfigurationError
            ? 'notConfigured'
            : error instanceof TmdbAuthenticationError
                ? 'invalidCredentials'
                : 'providerUnavailable';
        await interaction.reply({ content: runtimeText(locale, 'media', key), flags: MessageFlags.Ephemeral });
    }
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const query = interaction.options.getFocused();
    if (typeof query !== 'string' || query.trim().length < 2) {
        await interaction.respond([]);
        return;
    }

    const locale = await resolveInteractionOutputLocale(interaction);
    const type = parseSearchType(interaction.options.getString('type', false));
    try {
        const results = await searchTmdbMedia(query, type, locale);
        await interaction.respond(results.map(media => ({
            name: formatTmdbAutocompleteName(media, locale),
            value: encodeTmdbChoice(media.type, media.id),
        })));
    } catch {
        await interaction.respond([]);
    }
}

function parseSearchType(value: string | null): TmdbSearchType {
    return value === 'movie' || value === 'tv' ? value : 'all';
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, autocomplete };
