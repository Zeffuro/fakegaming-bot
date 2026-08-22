import { runtimeText } from '../../../core/runtimeCopy.js';
import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
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
    searchAniListAnimePage,
    type AniListFailure,
    type AniListSeason,
    type AniListSeasonScope,
    type AniListTitle,
} from '@zeffuro/fakegaming-common/anime';
import type { IntegrationHealthRecord } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { parseComponentLocale } from '../../../core/componentLocale.js';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { recordBotAuditEvent } from '../../../utils/audit.js';
import { anime as META } from '../commands.manifest.js';
import { anilistAutocomplete, parseAniListChoice } from '../shared/anilistAutocomplete.js';
import { buildAnimeActionRow, buildAnimeListActionRows, buildAnimeSearchActionRows, buildAnimeSeasonActionRows } from '../shared/animeComponents.js';
import { buildAnimeEmbed, buildAnimeListEmbed, buildAnimeNextEmbed, buildAnimeSearchResultsEmbed, buildAnimeSeasonEmbed } from '../shared/animeEmbed.js';
import { formatAnimeTitle } from '../shared/animeFormatters.js';
import { getAnimeCopy } from '../copy/animeCopy.js';

const ANIME_PAGE_SIZE = 10;

type AnimeSubscriptionRecord = {
    id?: number;
    anilistId: number;
    targetType: 'dm' | 'channel';
    userId?: string | null;
    guildId?: string | null;
    channelId?: string | null;
    reminderMinutes: number;
    paused?: boolean | null;
};

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
                .setName('pause')
                .setDescription('Pause anime episode reminders')
                .addStringOption((option) =>
                    option.setName('title').setDescription('Anime title').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Optional public notification channel subscription to pause (admin only)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('resume')
                .setDescription('Resume anime episode reminders')
                .addStringOption((option) =>
                    option.setName('title').setDescription('Anime title').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Optional public notification channel subscription to resume (admin only)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('test')
                .setDescription('Show latest health for anime episode reminders')
                .addStringOption((option) =>
                    option.setName('title').setDescription('Anime title').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Optional public notification channel subscription to inspect (admin only)')
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

function getNotSubscribableReason(anime: AniListTitle, locale: SupportedOutputLocale): string | null {
    if (isAniListSubscribable(anime)) return null;
    if (anime.status === 'FINISHED') {
        return runtimeText(locale, 'anime', 'reminderUnavailableFinished', {title: formatAnimeTitle(anime, locale)});
    }
    if (anime.status === 'CANCELLED') {
        return runtimeText(locale, 'anime', 'reminderUnavailableCancelled', {title: formatAnimeTitle(anime, locale)});
    }
    return null;
}

async function canSubscribeOrReply(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    anime: AniListTitle,
    locale: SupportedOutputLocale,
): Promise<boolean> {
    const reason = getNotSubscribableReason(anime, locale);
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

async function buildAnimeListPayload(userId: string, requestedPage = 1, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE) {
    const subscriptions = await getConfigManager().animeManager.subscriptions.getUserSubscriptions(userId);
    const total = subscriptions.length;
    const maxPage = Math.max(1, Math.ceil(total / ANIME_PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), maxPage);
    const startIndex = (page - 1) * ANIME_PAGE_SIZE;
    const pageSubscriptions = subscriptions.slice(startIndex, startIndex + ANIME_PAGE_SIZE);
    const rows = [];
    for (const subscription of pageSubscriptions) {
        const title = await getCachedOrRemoteTitle(subscription.anilistId);
        if (title) rows.push({ title, reminderMinutes: subscription.reminderMinutes, paused: subscription.paused });
    }

    return {
        embeds: [buildAnimeListEmbed(rows, { page, total, startIndex }, locale)],
        components: total
            ? buildAnimeListActionRows({
                anilistIds: pageSubscriptions.map((subscription) => subscription.anilistId),
                page,
                hasPrevious: page > 1,
                hasNext: page < maxPage,
                startIndex,
                locale,
            })
            : [],
    };
}

async function recordAnimePausedHealth(subscription: AnimeSubscriptionRecord, paused: boolean): Promise<void> {
    if (!subscription.id) return;
    try {
        await getConfigManager().integrationHealthManager.recordStatus({
            provider: 'anime',
            configId: subscription.id,
            guildId: subscription.guildId ?? null,
            channelId: subscription.channelId ?? null,
            status: paused ? 'paused' : 'unknown',
            metadata: {
                anilistId: subscription.anilistId,
                targetType: subscription.targetType,
                paused,
            },
        });
    } catch {
        // Health status should not block the Discord management action.
    }
}

async function executeSearch(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const selectedId = parseAniListChoice(input);
    if (!selectedId) {
        const { items: results, failure } = await searchAniListAnimePage(input);
        if (failure) {
            await interaction.reply({ content: formatAniListFailure(failure, locale), flags: MessageFlags.Ephemeral });
            return;
        }
        for (const result of results.slice(0, 10)) {
            await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(result));
        }
        await interaction.reply({
            embeds: [buildAnimeSearchResultsEmbed(results, input, 'ANIME', locale)],
            components: buildAnimeSearchActionRows(results.map((anime) => anime.id), 0, locale),
            flags: results.length ? undefined : MessageFlags.Ephemeral,
        });
        return;
    }

    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noAnimeFoundFor', {query: input}), flags: MessageFlags.Ephemeral});
        return;
    }

    await interaction.reply({
        embeds: [buildAnimeEmbed(anime, locale)],
        components: [buildAnimeActionRow(anime.id, locale)],
    });
}

function formatAniListFailure(failure: AniListFailure, locale: SupportedOutputLocale): string {
    if (failure.kind === 'rate-limited') {
        return runtimeText(locale, 'anime', 'anilistRateLimited');
    }
    return runtimeText(locale, 'anime', 'anilistUnavailable');
}

async function executeSubscribe(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const reminderMinutes = interaction.options.getInteger('reminder-minutes', false) ?? 30;
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noAnimeFoundFor', {query: input}), flags: MessageFlags.Ephemeral});
        return;
    }
    if (!(await canSubscribeOrReply(interaction, anime, locale))) return;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({content: runtimeText(locale, 'anime', 'channelSubscriptionConfigureServerOnly'), flags: MessageFlags.Ephemeral});
            return;
        }
        const created = await getConfigManager().animeManager.subscriptions.subscribeChannel({
            anilistId: anime.id,
            guildId,
            channelId: channel.id,
            reminderMinutes,
        });
        await recordBotAuditEvent(interaction, {
            action: created ? 'animeSubscription.create' : 'animeSubscription.update',
            targetType: 'animeSubscription',
            targetId: anime.id,
            guildId,
            metadata: {
                channelId: channel.id,
                reminderMinutes,
            },
        });
        await interaction.reply({
            content: runtimeText(locale, 'anime', 'channelSubscriptionSaved', { state: created ? 'created' : 'updated', channelId: channel.id, title: formatAnimeTitle(anime, locale) }),
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
        content: runtimeText(locale, 'anime', 'personalSubscriptionSaved', { state: created ? 'created' : 'updated', title: formatAnimeTitle(anime, locale) }),
        flags: MessageFlags.Ephemeral,
    });
}

async function executeList(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    await interaction.reply({ ...(await buildAnimeListPayload(interaction.user.id, 1, locale)), flags: MessageFlags.Ephemeral });
}

async function executeUnsubscribe(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noAnimeFoundFor', {query: input}), flags: MessageFlags.Ephemeral});
        return;
    }

    try {
        if (channel) {
            if (!(await requireAdmin(interaction))) return;
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.reply({content: runtimeText(locale, 'anime', 'channelSubscriptionRemoveServerOnly'), flags: MessageFlags.Ephemeral});
                return;
            }
            const manager = getConfigManager().animeManager.subscriptions;
            const subscription = await manager.getOnePlain({
                anilistId: anime.id,
                targetType: 'channel',
                guildId,
                channelId: channel.id,
            });
            await manager.unsubscribeChannel({
                anilistId: anime.id,
                guildId,
                channelId: channel.id,
            });
            await recordBotAuditEvent(interaction, {
                action: 'animeSubscription.delete',
                targetType: 'animeSubscription',
                targetId: getSubscriptionAuditTargetId(subscription, anime.id),
                guildId,
                metadata: {
                    anilistId: anime.id,
                    channelId: channel.id,
                },
            });
            await interaction.reply({content: runtimeText(locale, 'anime', 'unsubscribedFrom', {channelId: channel.id, title: formatAnimeTitle(anime, locale)}), flags: MessageFlags.Ephemeral});
            return;
        }

        await getConfigManager().animeManager.subscriptions.unsubscribeUser({
            anilistId: anime.id,
            userId: interaction.user.id,
        });
        await interaction.reply({content: runtimeText(locale, 'anime', 'unsubscribedYouFrom', {title: formatAnimeTitle(anime, locale)}), flags: MessageFlags.Ephemeral});
    } catch {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noMatchingSubscriptionFoundFor', {title: formatAnimeTitle(anime, locale)}), flags: MessageFlags.Ephemeral});
    }
}

async function executeSetPaused(interaction: ChatInputCommandInteraction, paused: boolean, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noAnimeFoundFor', {query: input}), flags: MessageFlags.Ephemeral});
        return;
    }

    const manager = getConfigManager().animeManager.subscriptions;
    let subscription: AnimeSubscriptionRecord | null;
    let targetDescription: string;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({content: runtimeText(locale, 'anime', 'channelSubscriptionManageServerOnly'), flags: MessageFlags.Ephemeral});
            return;
        }
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'channel',
            guildId,
            channelId: channel.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = runtimeText(locale, 'anime', 'channelReminders', {channelId: channel.id});
    } else {
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'dm',
            userId: interaction.user.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = runtimeText(locale, "anime", "yourDmReminders");
    }

    if (!subscription?.id) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noMatchingSubscriptionFoundFor', {title: formatAnimeTitle(anime, locale)}), flags: MessageFlags.Ephemeral});
        return;
    }

    if (Boolean(subscription.paused) === paused) {
        await interaction.reply({
            content: runtimeText(locale, 'anime', 'subscriptionAlreadyState', { target: targetDescription, title: formatAnimeTitle(anime, locale), state: paused ? 'paused' : 'active' }),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await manager.setPaused(subscription.id, paused);
    await recordBotAuditEvent(interaction, {
        action: paused ? 'animeSubscription.pause' : 'animeSubscription.resume',
        targetType: 'animeSubscription',
        targetId: subscription.id,
        guildId: subscription.guildId ?? null,
        metadata: {
            anilistId: anime.id,
            channelId: subscription.channelId ?? null,
            targetType: subscription.targetType,
            paused,
        },
    });
    await recordAnimePausedHealth(subscription, paused);
    await interaction.reply({
        content: runtimeText(locale, 'anime', 'subscriptionStateChanged', { state: paused ? 'paused' : 'active', target: targetDescription, title: formatAnimeTitle(anime, locale) }),
        flags: MessageFlags.Ephemeral,
    });
}

async function executeTestHealth(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noAnimeFoundFor', {query: input}), flags: MessageFlags.Ephemeral});
        return;
    }

    const manager = getConfigManager().animeManager.subscriptions;
    let subscription: AnimeSubscriptionRecord | null;
    let targetDescription: string;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({content: runtimeText(locale, 'anime', 'channelSubscriptionInspectServerOnly'), flags: MessageFlags.Ephemeral});
            return;
        }
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'channel',
            guildId,
            channelId: channel.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = runtimeText(locale, 'anime', 'channelReminders', {channelId: channel.id});
    } else {
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'dm',
            userId: interaction.user.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = runtimeText(locale, "anime", "yourDmReminders");
    }

    if (!subscription?.id) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noMatchingSubscriptionFoundFor', {title: formatAnimeTitle(anime, locale)}), flags: MessageFlags.Ephemeral});
        return;
    }

    const health = await getConfigManager().integrationHealthManager.getForConfig('anime', subscription.id);
    if (!health) {
        await interaction.reply({
            content: runtimeText(locale, 'anime', 'noHealthRecord', {target: targetDescription, title: formatAnimeTitle(anime, locale)}),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: formatAnimeHealthReply(targetDescription, formatAnimeTitle(anime, locale), health, locale),
        flags: MessageFlags.Ephemeral,
    });
}

function getSubscriptionAuditTargetId(subscription: { id?: unknown } | null, fallback: number): string | number {
    const id = subscription?.id;
    if (typeof id === 'string' || typeof id === 'number') return id;
    return fallback;
}

async function executeNext(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subscriptions = (await getConfigManager().animeManager.subscriptions.getUserSubscriptions(interaction.user.id))
        .filter((subscription) => !subscription.paused);
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
    await interaction.editReply({ embeds: [buildAnimeNextEmbed(schedules, locale)] });
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

function formatSeasonName(season: AniListSeason, locale: SupportedOutputLocale): string {
    const keys = { WINTER: 'seasonWinter', SPRING: 'seasonSpring', SUMMER: 'seasonSummer', FALL: 'seasonFall' } as const;
    return runtimeText(locale, 'anime', keys[season]!);
}

async function buildAnimeSeasonPayload(
    season: AniListSeason,
    year: number,
    page = 1,
    scope: AniListSeasonScope = 'airing',
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
) {
    const result = await getAniListSeasonAnimePage(season, year, page, ANIME_PAGE_SIZE, { scope });
    for (const anime of result.items) {
        await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
    }
    const currentPage = result.pageInfo.currentPage ?? page;
    const perPage = result.pageInfo.perPage ?? ANIME_PAGE_SIZE;
    const startIndex = (currentPage - 1) * perPage;

    return {
        embeds: [buildAnimeSeasonEmbed(result.items, `${formatSeasonName(season, locale)} ${year} - ${formatAniListSeasonScope(scope, locale)}`, result.pageInfo, locale)],
        components: buildAnimeSeasonActionRows({
            anilistIds: result.items.map((anime) => anime.id),
            season,
            year,
            page: currentPage,
            scope,
            hasPrevious: currentPage > 1,
            hasNext: Boolean(result.pageInfo.hasNextPage),
            startIndex,
            locale,
        }),
    };
}

async function executeSeason(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    await interaction.deferReply();
    const value = interaction.options.getString('season', true);
    const yearOption = interaction.options.getInteger('year', false);
    const scope = (interaction.options.getString('scope', false) ?? 'airing') as AniListSeasonScope;
    const resolved = resolveSeason(value, yearOption);
    await interaction.editReply(await buildAnimeSeasonPayload(resolved.season, resolved.year, 1, scope, locale));
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'search') {
        await executeSearch(interaction, locale);
        return;
    }
    if (subcommand === 'subscribe') {
        await executeSubscribe(interaction, locale);
        return;
    }
    if (subcommand === 'list') {
        await executeList(interaction, locale);
        return;
    }
    if (subcommand === 'unsubscribe') {
        await executeUnsubscribe(interaction, locale);
        return;
    }
    if (subcommand === 'pause') {
        await executeSetPaused(interaction, true, locale);
        return;
    }
    if (subcommand === 'resume') {
        await executeSetPaused(interaction, false, locale);
        return;
    }
    if (subcommand === 'test') {
        await executeTestHealth(interaction, locale);
        return;
    }
    if (subcommand === 'next') {
        await executeNext(interaction, locale);
        return;
    }
    if (subcommand === 'season') {
        await executeSeason(interaction, locale);
        return;
    }
    await interaction.reply({ content: runtimeText(locale, "anime", "unknownAnimeSubcommand"), flags: MessageFlags.Ephemeral });
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    await anilistAutocomplete(interaction, 'ANIME', locale);
}

async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
    const subscribeMatch = /^anime:subscribe:(\d+)(?::([^:]+))?$/.exec(interaction.customId);
    if (subscribeMatch) {
        const locale = parseComponentLocale(subscribeMatch[2]) ?? await resolveInteractionOutputLocale(interaction);
        const anilistId = Number(subscribeMatch[1]);
        const anime = await getAniListAnimeById(anilistId);
        if (anime) {
            await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(anime));
            if (!(await canSubscribeOrReply(interaction, anime, locale))) return true;
        }
        const created = await getConfigManager().animeManager.subscriptions.subscribeUser({
            anilistId,
            userId: interaction.user.id,
            reminderMinutes: 30,
        });
        await interaction.reply({
            content: runtimeText(locale, 'anime', 'buttonSubscriptionSaved', { state: created ? 'created' : 'existing', title: anime ? formatAnimeTitle(anime, locale) : `AniList #${anilistId}` }),
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const unsubscribeMatch = /^anime:unsubscribe:(\d+)(?::([^:]+))?$/.exec(interaction.customId);
    if (unsubscribeMatch) {
        const locale = parseComponentLocale(unsubscribeMatch[2]) ?? await resolveInteractionOutputLocale(interaction);
        const anilistId = Number(unsubscribeMatch[1]);
        try {
            await getConfigManager().animeManager.subscriptions.unsubscribeUser({
                anilistId,
                userId: interaction.user.id,
            });
        } catch {
            await interaction.reply({ content: runtimeText(locale, "anime", "thatSubscriptionIsAlreadyGone"), flags: MessageFlags.Ephemeral });
            return true;
        }
        await interaction.update({
            content: runtimeText(locale, 'anime', 'unsubscribedFromAnilist', {anilistId}),
            ...(await buildAnimeListPayload(interaction.user.id, 1, locale)),
        });
        return true;
    }

    const listMatch = /^anime:list:(\d+)(?::([^:]+))?$/.exec(interaction.customId);
    if (listMatch) {
        const locale = parseComponentLocale(listMatch[2]) ?? await resolveInteractionOutputLocale(interaction);
        await interaction.update({ content: null, ...(await buildAnimeListPayload(interaction.user.id, Number(listMatch[1]), locale)) });
        return true;
    }

    const seasonMatch = /^anime:season:(airing|chart|tv|all):(WINTER|SPRING|SUMMER|FALL):(\d{4}):(\d+)(?::([^:]+))?$/.exec(interaction.customId);
    if (seasonMatch) {
        const locale = parseComponentLocale(seasonMatch[5]) ?? await resolveInteractionOutputLocale(interaction);
        await interaction.update(await buildAnimeSeasonPayload(
            seasonMatch[2] as AniListSeason,
            Number(seasonMatch[3]),
            Number(seasonMatch[4]),
            seasonMatch[1] as AniListSeasonScope,
            locale,
        ));
        return true;
    }

    return false;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, autocomplete, handleComponent };

function formatAnimeHealthReply(
    targetDescription: string,
    title: string,
    health: IntegrationHealthRecord,
    locale: SupportedOutputLocale,
): string {
    const copy = getAnimeCopy(locale);
    const lines = [
        runtimeText(locale, 'anime', 'healthHeading', {label: copy.latestHealth, target: targetDescription, title}),
        `${copy.status}: \`${escapeInlineCode(formatHealthStatus(health.status, locale))}\``,
        `${copy.lastChecked}: ${formatHealthDate(health.lastCheckedAt, locale)}`,
        `${copy.lastSuccess}: ${formatHealthDate(health.lastSuccessAt, locale)}`,
        `${copy.lastFailure}: ${formatHealthDate(health.lastFailureAt, locale)}`,
        `${copy.lastDelivery}: ${formatHealthDate(health.lastDeliveryAt, locale)}`,
        `${copy.consecutiveFailures}: ${health.consecutiveFailures}`,
    ];

    if (health.lastErrorCode || health.lastErrorMessage) {
        const code = health.lastErrorCode ? `\`${escapeInlineCode(health.lastErrorCode)}\` ` : '';
        lines.push(`${copy.lastError}: ${code}${truncateHealthLine(health.lastErrorMessage ?? copy.unknownError)}`);
    }

    return lines.join('\n');
}

function formatHealthStatus(status: string, locale: SupportedOutputLocale): string {
    const keys = {
        healthy: 'healthHealthy', success: 'healthSuccess', warning: 'healthWarning', error: 'healthError',
        failed: 'healthFailed', paused: 'healthPaused', unknown: 'healthUnknown',
    } as const;
    const key = keys[status as keyof typeof keys];
    return key ? runtimeText(locale, 'anime', key) : status;
}

function formatHealthDate(value: Date | string | null | undefined, locale: SupportedOutputLocale): string {
    if (!value) return runtimeText(locale, "anime", "never");
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString();
}

function escapeInlineCode(value: string): string {
    return value.replace(/`/g, "'");
}

function truncateHealthLine(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 180) return normalized;
    return `${normalized.slice(0, 177)}...`;
}
