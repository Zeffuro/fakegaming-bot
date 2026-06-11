import {
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import {
    getAniListAnimeById,
    getAniListSeasonAnimePage,
    getCurrentAniListSeason,
    getAniListNextAiring,
    getNextAniListSeason,
    formatAniListSeasonScope,
    isAniListSubscribable,
    mapAniListTitleToInput,
    searchAniListAnime,
    type AniListSeason,
    type AniListSeasonScope,
    type AniListTitle,
} from '@zeffuro/fakegaming-common/anime';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { anime as META } from '../commands.manifest.js';
import { anilistAutocomplete, parseAniListChoice } from '../shared/anilistAutocomplete.js';
import { buildAnimeActionRow, buildAnimeListActionRows, buildAnimeSearchActionRows, buildAnimeSeasonActionRows } from '../shared/animeComponents.js';
import { buildAnimeEmbed, buildAnimeListEmbed, buildAnimeNextEmbed, buildAnimeSearchResultsEmbed, buildAnimeSeasonEmbed } from '../shared/animeEmbed.js';
import { formatAnimeTitle } from '../shared/animeFormatters.js';

const ANIME_PAGE_SIZE = 10;

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addSubcommand((subcommand) =>
            subcommand
                .setName('search')
                .setDescription('Search for an anime')
                .addStringOption((option) =>
                    option.setName('title').setDescription('Anime title').setRequired(true).setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('subscribe')
                .setDescription('Subscribe to anime episode reminders')
                .addStringOption((option) =>
                    option.setName('title').setDescription('Anime title').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Optional public notification channel (admin only)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('reminder-minutes')
                        .setDescription('Minutes before airing to remind you')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(1440)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription('Show your anime subscriptions')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('unsubscribe')
                .setDescription('Unsubscribe from anime episode reminders')
                .addStringOption((option) =>
                    option.setName('title').setDescription('Anime title').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Optional public notification channel subscription to remove (admin only)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('next')
                .setDescription('Show upcoming episodes for your subscriptions')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('season')
                .setDescription('Browse anime airing in a season')
                .addStringOption((option) =>
                    option
                        .setName('season')
                        .setDescription('Season to browse')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Current', value: 'current' },
                            { name: 'Next', value: 'next' },
                            { name: 'Winter', value: 'WINTER' },
                            { name: 'Spring', value: 'SPRING' },
                            { name: 'Summer', value: 'SUMMER' },
                            { name: 'Fall', value: 'FALL' },
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName('year')
                        .setDescription('Year for a specific season')
                        .setRequired(false)
                        .setMinValue(1940)
                        .setMaxValue(2100)
                )
                .addStringOption((option) =>
                    option
                        .setName('scope')
                        .setDescription('Filter seasonal results')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Airing/upcoming', value: 'airing' },
                            { name: 'Season chart', value: 'chart' },
                            { name: 'TV only', value: 'tv' },
                            { name: 'All known formats', value: 'all' },
                        )
                )
        )
);

async function resolveAnime(input: string): Promise<AniListTitle | null> {
    const selectedId = parseAniListChoice(input);
    const anime = selectedId ? await getAniListAnimeById(selectedId) : (await searchAniListAnime(input))[0] ?? null;
    if (!anime) return null;
    await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
    if (anime.nextAiringEpisode) {
        await getConfigManager().animeManager.episodes.upsertEpisode({
            anilistId: anime.id,
            episode: anime.nextAiringEpisode.episode,
            airingAt: anime.nextAiringEpisode.airingAt * 1000,
        });
    }
    return anime;
}

function getNotSubscribableReason(anime: AniListTitle): string | null {
    if (isAniListSubscribable(anime)) return null;
    if (anime.status === 'FINISHED') {
        return `**${formatAnimeTitle(anime)}** is already finished, so episode reminders would never fire. Search for the sequel/next season entry instead.`;
    }
    if (anime.status === 'CANCELLED') {
        return `**${formatAnimeTitle(anime)}** is cancelled, so episode reminders would never fire.`;
    }
    return null;
}

async function canSubscribeOrReply(interaction: ChatInputCommandInteraction | ButtonInteraction, anime: AniListTitle): Promise<boolean> {
    const reason = getNotSubscribableReason(anime);
    if (!reason) return true;
    await interaction.reply({ content: reason, flags: MessageFlags.Ephemeral });
    return false;
}

async function getCachedOrRemoteTitle(anilistId: number) {
    const cached = await getConfigManager().animeManager.titles.getOnePlain({ anilistId });
    if (cached) return cached;
    const anime = await getAniListAnimeById(anilistId);
    if (!anime) return null;
    const input = mapAniListTitleToInput(anime);
    await getConfigManager().animeManager.titles.upsertTitle(input);
    return input;
}

async function buildAnimeListPayload(userId: string, requestedPage = 1) {
    const subscriptions = await getConfigManager().animeManager.subscriptions.getUserSubscriptions(userId);
    const total = subscriptions.length;
    const maxPage = Math.max(1, Math.ceil(total / ANIME_PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), maxPage);
    const startIndex = (page - 1) * ANIME_PAGE_SIZE;
    const pageSubscriptions = subscriptions.slice(startIndex, startIndex + ANIME_PAGE_SIZE);
    const rows = [];
    for (const subscription of pageSubscriptions) {
        const title = await getCachedOrRemoteTitle(subscription.anilistId);
        if (title) rows.push({ title, reminderMinutes: subscription.reminderMinutes });
    }

    return {
        embeds: [buildAnimeListEmbed(rows, { page, total, startIndex })],
        components: total
            ? buildAnimeListActionRows({
                anilistIds: pageSubscriptions.map((subscription) => subscription.anilistId),
                page,
                hasPrevious: page > 1,
                hasNext: page < maxPage,
                startIndex,
            })
            : [],
    };
}

async function executeSearch(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('title', true);
    const selectedId = parseAniListChoice(input);
    if (!selectedId) {
        const results = await searchAniListAnime(input);
        for (const result of results.slice(0, 10)) {
            await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(result));
        }
        await interaction.reply({
            embeds: [buildAnimeSearchResultsEmbed(results, input)],
            components: buildAnimeSearchActionRows(results.map((anime) => anime.id)),
            flags: results.length ? undefined : MessageFlags.Ephemeral,
        });
        return;
    }

    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({ content: `No anime found for \`${input}\`.`, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.reply({
        embeds: [buildAnimeEmbed(anime)],
        components: [buildAnimeActionRow(anime.id)],
    });
}

async function executeSubscribe(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const reminderMinutes = interaction.options.getInteger('reminder-minutes', false) ?? 30;
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({ content: `No anime found for \`${input}\`.`, flags: MessageFlags.Ephemeral });
        return;
    }
    if (!(await canSubscribeOrReply(interaction, anime))) return;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'Channel subscriptions can only be configured in a server.', flags: MessageFlags.Ephemeral });
            return;
        }
        const created = await getConfigManager().animeManager.subscriptions.subscribeChannel({
            anilistId: anime.id,
            guildId,
            channelId: channel.id,
            reminderMinutes,
        });
        await interaction.reply({
            content: `${created ? 'Subscribed' : 'Updated subscription for'} <#${channel.id}> to **${formatAnimeTitle(anime)}**.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const created = await getConfigManager().animeManager.subscriptions.subscribeUser({
        anilistId: anime.id,
        userId: interaction.user.id,
        reminderMinutes,
    });
    await interaction.reply({
        content: `${created ? 'Subscribed you' : 'Updated your subscription'} to **${formatAnimeTitle(anime)}**. Episode reminders will use DMs by default.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function executeList(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ ...(await buildAnimeListPayload(interaction.user.id)), flags: MessageFlags.Ephemeral });
}

async function executeUnsubscribe(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({ content: `No anime found for \`${input}\`.`, flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        if (channel) {
            if (!(await requireAdmin(interaction))) return;
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.reply({ content: 'Channel subscriptions can only be removed in a server.', flags: MessageFlags.Ephemeral });
                return;
            }
            await getConfigManager().animeManager.subscriptions.unsubscribeChannel({
                anilistId: anime.id,
                guildId,
                channelId: channel.id,
            });
            await interaction.reply({ content: `Unsubscribed <#${channel.id}> from **${formatAnimeTitle(anime)}**.`, flags: MessageFlags.Ephemeral });
            return;
        }

        await getConfigManager().animeManager.subscriptions.unsubscribeUser({
            anilistId: anime.id,
            userId: interaction.user.id,
        });
        await interaction.reply({ content: `Unsubscribed you from **${formatAnimeTitle(anime)}**.`, flags: MessageFlags.Ephemeral });
    } catch {
        await interaction.reply({ content: `No matching subscription found for **${formatAnimeTitle(anime)}**.`, flags: MessageFlags.Ephemeral });
    }
}

async function executeNext(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subscriptions = await getConfigManager().animeManager.subscriptions.getUserSubscriptions(interaction.user.id);
    const schedules = await getAniListNextAiring(subscriptions.map((sub) => sub.anilistId));
    for (const item of schedules) {
        if (item.media) {
            await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(item.media));
        }
        await getConfigManager().animeManager.episodes.upsertEpisode({
            anilistId: item.mediaId,
            episode: item.episode,
            airingAt: item.airingAt * 1000,
        });
    }
    await interaction.editReply({ embeds: [buildAnimeNextEmbed(schedules)] });
}

function resolveSeason(value: string, yearOption: number | null): { season: AniListSeason; year: number; label: string } {
    if (value === 'current') {
        const current = getCurrentAniListSeason();
        return { ...current, label: `${current.season} ${current.year}` };
    }
    if (value === 'next') {
        const next = getNextAniListSeason();
        return { ...next, label: `${next.season} ${next.year}` };
    }
    const season = value as AniListSeason;
    const year = yearOption ?? new Date().getUTCFullYear();
    return { season, year, label: `${season} ${year}` };
}

async function buildAnimeSeasonPayload(season: AniListSeason, year: number, page = 1, scope: AniListSeasonScope = 'airing') {
    const result = await getAniListSeasonAnimePage(season, year, page, ANIME_PAGE_SIZE, { scope });
    for (const anime of result.items) {
        await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
    }
    const currentPage = result.pageInfo.currentPage ?? page;
    const perPage = result.pageInfo.perPage ?? ANIME_PAGE_SIZE;
    const startIndex = (currentPage - 1) * perPage;

    return {
        embeds: [buildAnimeSeasonEmbed(result.items, `${season} ${year} - ${formatAniListSeasonScope(scope)}`, result.pageInfo)],
        components: buildAnimeSeasonActionRows({
            anilistIds: result.items.map((anime) => anime.id),
            season,
            year,
            page: currentPage,
            scope,
            hasPrevious: currentPage > 1,
            hasNext: Boolean(result.pageInfo.hasNextPage),
            startIndex,
        }),
    };
}

async function executeSeason(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const value = interaction.options.getString('season', true);
    const yearOption = interaction.options.getInteger('year', false);
    const scope = (interaction.options.getString('scope', false) ?? 'airing') as AniListSeasonScope;
    const resolved = resolveSeason(value, yearOption);
    await interaction.editReply(await buildAnimeSeasonPayload(resolved.season, resolved.year, 1, scope));
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'search') {
        await executeSearch(interaction);
        return;
    }
    if (subcommand === 'subscribe') {
        await executeSubscribe(interaction);
        return;
    }
    if (subcommand === 'list') {
        await executeList(interaction);
        return;
    }
    if (subcommand === 'unsubscribe') {
        await executeUnsubscribe(interaction);
        return;
    }
    if (subcommand === 'next') {
        await executeNext(interaction);
        return;
    }
    if (subcommand === 'season') {
        await executeSeason(interaction);
        return;
    }
    await interaction.reply({ content: 'Unknown anime subcommand.', flags: MessageFlags.Ephemeral });
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await anilistAutocomplete(interaction);
}

async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
    const subscribeMatch = /^anime:subscribe:(\d+)$/.exec(interaction.customId);
    if (subscribeMatch) {
        const anilistId = Number(subscribeMatch[1]);
        const anime = await getAniListAnimeById(anilistId);
        if (anime) {
            await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
            if (!(await canSubscribeOrReply(interaction, anime))) return true;
        }
        const created = await getConfigManager().animeManager.subscriptions.subscribeUser({
            anilistId,
            userId: interaction.user.id,
            reminderMinutes: 30,
        });
        await interaction.reply({
            content: `${created ? 'Subscribed you' : 'You are already subscribed'} to **${anime ? formatAnimeTitle(anime) : `AniList #${anilistId}`}**. Use \`/anime list\` to view or unsubscribe.`,
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const unsubscribeMatch = /^anime:unsubscribe:(\d+)$/.exec(interaction.customId);
    if (unsubscribeMatch) {
        const anilistId = Number(unsubscribeMatch[1]);
        try {
            await getConfigManager().animeManager.subscriptions.unsubscribeUser({
                anilistId,
                userId: interaction.user.id,
            });
        } catch {
            await interaction.reply({ content: 'That subscription is already gone.', flags: MessageFlags.Ephemeral });
            return true;
        }
        await interaction.update({
            content: `Unsubscribed from AniList #${anilistId}.`,
            ...(await buildAnimeListPayload(interaction.user.id)),
        });
        return true;
    }

    const listMatch = /^anime:list:(\d+)$/.exec(interaction.customId);
    if (listMatch) {
        await interaction.update({ content: null, ...(await buildAnimeListPayload(interaction.user.id, Number(listMatch[1]))) });
        return true;
    }

    const seasonMatch = /^anime:season:(airing|chart|tv|all):(WINTER|SPRING|SUMMER|FALL):(\d{4}):(\d+)$/.exec(interaction.customId);
    if (seasonMatch) {
        await interaction.update(await buildAnimeSeasonPayload(
            seasonMatch[2] as AniListSeason,
            Number(seasonMatch[3]),
            Number(seasonMatch[4]),
            seasonMatch[1] as AniListSeasonScope,
        ));
        return true;
    }

    return false;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, autocomplete, handleComponent };
