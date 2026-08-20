import { DEFAULT_OUTPUT_LOCALE, resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
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
                .setNameLocalization('nl', 'zoeken')
                .setDescription('Search for an anime')
                .setDescriptionLocalization('nl', 'Zoek een anime')
                .addStringOption((option) =>
                    option.setName('title').setNameLocalization('nl', 'titel').setDescription('Anime title').setDescriptionLocalization('nl', 'Animetitel').setRequired(true).setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('subscribe')
                .setNameLocalization('nl', 'abonneren')
                .setDescription('Subscribe to anime episode reminders')
                .setDescriptionLocalization('nl', 'Abonneer je op meldingen voor anime-afleveringen')
                .addStringOption((option) =>
                    option.setName('title').setNameLocalization('nl', 'titel').setDescription('Anime title').setDescriptionLocalization('nl', 'Animetitel').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setNameLocalization('nl', 'kanaal')
                        .setDescription('Optional public notification channel (admin only)')
                        .setDescriptionLocalization('nl', 'Optioneel openbaar meldingskanaal (alleen beheerders)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('reminder-minutes')
                        .setNameLocalization('nl', 'melding-minuten')
                        .setDescription('Minutes before airing to remind you')
                        .setDescriptionLocalization('nl', 'Minuten voor uitzending waarop je een melding krijgt')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(1440)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setNameLocalization('nl', 'lijst')
                .setDescription('Show your anime subscriptions')
                .setDescriptionLocalization('nl', 'Toon je anime-abonnementen')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('unsubscribe')
                .setNameLocalization('nl', 'opzeggen')
                .setDescription('Unsubscribe from anime episode reminders')
                .setDescriptionLocalization('nl', 'Zeg meldingen voor anime-afleveringen op')
                .addStringOption((option) =>
                    option.setName('title').setNameLocalization('nl', 'titel').setDescription('Anime title').setDescriptionLocalization('nl', 'Animetitel').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setNameLocalization('nl', 'kanaal')
                        .setDescription('Optional public notification channel subscription to remove (admin only)')
                        .setDescriptionLocalization('nl', 'Optioneel kanaalabonnement om op te zeggen (alleen beheerders)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('pause')
                .setNameLocalization('nl', 'pauzeren')
                .setDescription('Pause anime episode reminders')
                .setDescriptionLocalization('nl', 'Pauzeer meldingen voor anime-afleveringen')
                .addStringOption((option) =>
                    option.setName('title').setNameLocalization('nl', 'titel').setDescription('Anime title').setDescriptionLocalization('nl', 'Animetitel').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setNameLocalization('nl', 'kanaal')
                        .setDescription('Optional public notification channel subscription to pause (admin only)')
                        .setDescriptionLocalization('nl', 'Optioneel kanaalabonnement om te pauzeren (alleen beheerders)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('resume')
                .setNameLocalization('nl', 'hervatten')
                .setDescription('Resume anime episode reminders')
                .setDescriptionLocalization('nl', 'Hervat meldingen voor anime-afleveringen')
                .addStringOption((option) =>
                    option.setName('title').setNameLocalization('nl', 'titel').setDescription('Anime title').setDescriptionLocalization('nl', 'Animetitel').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setNameLocalization('nl', 'kanaal')
                        .setDescription('Optional public notification channel subscription to resume (admin only)')
                        .setDescriptionLocalization('nl', 'Optioneel kanaalabonnement om te hervatten (alleen beheerders)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('test')
                .setNameLocalization('nl', 'status')
                .setDescription('Show latest health for anime episode reminders')
                .setDescriptionLocalization('nl', 'Toon de laatste status van meldingen voor anime-afleveringen')
                .addStringOption((option) =>
                    option.setName('title').setNameLocalization('nl', 'titel').setDescription('Anime title').setDescriptionLocalization('nl', 'Animetitel').setRequired(true).setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setNameLocalization('nl', 'kanaal')
                        .setDescription('Optional public notification channel subscription to inspect (admin only)')
                        .setDescriptionLocalization('nl', 'Optioneel kanaalabonnement om te controleren (alleen beheerders)')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('next')
                .setNameLocalization('nl', 'komend')
                .setDescription('Show upcoming episodes for your subscriptions')
                .setDescriptionLocalization('nl', 'Toon komende afleveringen voor je abonnementen')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('season')
                .setNameLocalization('nl', 'seizoen')
                .setDescription('Browse anime airing in a season')
                .setDescriptionLocalization('nl', 'Bekijk anime die in een seizoen wordt uitgezonden')
                .addStringOption((option) =>
                    option
                        .setName('season')
                        .setNameLocalization('nl', 'seizoen')
                        .setDescription('Season to browse')
                        .setDescriptionLocalization('nl', 'Seizoen om te bekijken')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Current', name_localizations: { nl: 'Huidig' }, value: 'current' },
                            { name: 'Next', name_localizations: { nl: 'Volgend' }, value: 'next' },
                            { name: 'Winter', name_localizations: { nl: 'Winter' }, value: 'WINTER' },
                            { name: 'Spring', name_localizations: { nl: 'Lente' }, value: 'SPRING' },
                            { name: 'Summer', name_localizations: { nl: 'Zomer' }, value: 'SUMMER' },
                            { name: 'Fall', name_localizations: { nl: 'Herfst' }, value: 'FALL' },
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName('year')
                        .setNameLocalization('nl', 'jaar')
                        .setDescription('Year for a specific season')
                        .setDescriptionLocalization('nl', 'Jaar van een specifiek seizoen')
                        .setRequired(false)
                        .setMinValue(1940)
                        .setMaxValue(2100)
                )
                .addStringOption((option) =>
                    option
                        .setName('scope')
                        .setNameLocalization('nl', 'bereik')
                        .setDescription('Filter seasonal results')
                        .setDescriptionLocalization('nl', 'Filter de seizoensresultaten')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Airing/upcoming', name_localizations: { nl: 'Wordt uitgezonden/komend' }, value: 'airing' },
                            { name: 'Season chart', name_localizations: { nl: 'Seizoensoverzicht' }, value: 'chart' },
                            { name: 'TV only', name_localizations: { nl: 'Alleen tv' }, value: 'tv' },
                            { name: 'All known formats', name_localizations: { nl: 'Alle bekende indelingen' }, value: 'all' },
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
        return resolveLocaleValue(locale, { en: `**${formatAnimeTitle(anime, locale)}** is already finished, so episode reminders would never fire. Search for the sequel/next season entry instead.`, nl: `**${formatAnimeTitle(anime, locale)}** is al afgelopen, dus meldingen voor afleveringen zouden nooit worden verstuurd. Zoek in plaats daarvan naar het vervolg of het volgende seizoen.` });
    }
    if (anime.status === 'CANCELLED') {
        return resolveLocaleValue(locale, { en: `**${formatAnimeTitle(anime, locale)}** is cancelled, so episode reminders would never fire.`, nl: `**${formatAnimeTitle(anime, locale)}** is geannuleerd, dus meldingen voor afleveringen zouden nooit worden verstuurd.` });
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
        const results = await searchAniListAnime(input);
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
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No anime found for \`${input}\`.`, nl: `Geen anime gevonden voor \`${input}\`.` }), flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.reply({
        embeds: [buildAnimeEmbed(anime, locale)],
        components: [buildAnimeActionRow(anime.id, locale)],
    });
}

async function executeSubscribe(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const reminderMinutes = interaction.options.getInteger('reminder-minutes', false) ?? 30;
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No anime found for \`${input}\`.`, nl: `Geen anime gevonden voor \`${input}\`.` }), flags: MessageFlags.Ephemeral });
        return;
    }
    if (!(await canSubscribeOrReply(interaction, anime, locale))) return;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: resolveLocaleValue(locale, { en: 'Channel subscriptions can only be configured in a server.', nl: 'Kanaalabonnementen kunnen alleen op een server worden ingesteld.' }), flags: MessageFlags.Ephemeral });
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
            content: resolveLocaleValue(locale, { en: `${created ? 'Subscribed' : 'Updated subscription for'} <#${channel.id}> to **${formatAnimeTitle(anime, locale)}**.`, nl: `${created ? 'Geabonneerd' : 'Abonnement bijgewerkt voor'} <#${channel.id}> op **${formatAnimeTitle(anime, locale)}**.` }),
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
        content: resolveLocaleValue(locale, { en: `${created ? 'Subscribed you' : 'Updated your subscription'} to **${formatAnimeTitle(anime, locale)}**. Episode reminders will use DMs by default.`, nl: `${created ? 'Je bent geabonneerd' : 'Je abonnement is bijgewerkt'} op **${formatAnimeTitle(anime, locale)}**. Meldingen voor afleveringen worden standaard via DM verstuurd.` }),
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
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No anime found for \`${input}\`.`, nl: `Geen anime gevonden voor \`${input}\`.` }), flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        if (channel) {
            if (!(await requireAdmin(interaction))) return;
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.reply({ content: resolveLocaleValue(locale, { en: 'Channel subscriptions can only be removed in a server.', nl: 'Kanaalabonnementen kunnen alleen op een server worden opgezegd.' }), flags: MessageFlags.Ephemeral });
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
            await interaction.reply({ content: resolveLocaleValue(locale, { en: `Unsubscribed <#${channel.id}> from **${formatAnimeTitle(anime, locale)}**.`, nl: `Abonnement van <#${channel.id}> op **${formatAnimeTitle(anime, locale)}** opgezegd.` }), flags: MessageFlags.Ephemeral });
            return;
        }

        await getConfigManager().animeManager.subscriptions.unsubscribeUser({
            anilistId: anime.id,
            userId: interaction.user.id,
        });
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `Unsubscribed you from **${formatAnimeTitle(anime, locale)}**.`, nl: `Je abonnement op **${formatAnimeTitle(anime, locale)}** is opgezegd.` }), flags: MessageFlags.Ephemeral });
    } catch {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No matching subscription found for **${formatAnimeTitle(anime, locale)}**.`, nl: `Geen overeenkomend abonnement gevonden voor **${formatAnimeTitle(anime, locale)}**.` }), flags: MessageFlags.Ephemeral });
    }
}

async function executeSetPaused(interaction: ChatInputCommandInteraction, paused: boolean, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No anime found for \`${input}\`.`, nl: `Geen anime gevonden voor \`${input}\`.` }), flags: MessageFlags.Ephemeral });
        return;
    }

    const manager = getConfigManager().animeManager.subscriptions;
    let subscription: AnimeSubscriptionRecord | null;
    let targetDescription: string;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: resolveLocaleValue(locale, { en: 'Channel subscriptions can only be managed in a server.', nl: 'Kanaalabonnementen kunnen alleen op een server worden beheerd.' }), flags: MessageFlags.Ephemeral });
            return;
        }
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'channel',
            guildId,
            channelId: channel.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = resolveLocaleValue(locale, { en: `<#${channel.id}> reminders`, nl: `meldingen in <#${channel.id}>` });
    } else {
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'dm',
            userId: interaction.user.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = resolveLocaleValue(locale, { en: 'your DM reminders', nl: 'je DM-meldingen' });
    }

    if (!subscription?.id) {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No matching subscription found for **${formatAnimeTitle(anime, locale)}**.`, nl: `Geen overeenkomend abonnement gevonden voor **${formatAnimeTitle(anime, locale)}**.` }), flags: MessageFlags.Ephemeral });
        return;
    }

    if (Boolean(subscription.paused) === paused) {
        await interaction.reply({
            content: resolveLocaleValue(locale, { en: `${targetDescription} for **${formatAnimeTitle(anime, locale)}** are already ${paused ? 'paused' : 'active'}.`, nl: `${targetDescription} voor **${formatAnimeTitle(anime, locale)}** zijn al ${paused ? 'gepauzeerd' : 'actief'}.` }),
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
        content: resolveLocaleValue(locale, { en: `${paused ? 'Paused' : 'Resumed'} ${targetDescription} for **${formatAnimeTitle(anime, locale)}**.`, nl: `${paused ? 'Gepauzeerd' : 'Hervat'}: ${targetDescription} voor **${formatAnimeTitle(anime, locale)}**.` }),
        flags: MessageFlags.Ephemeral,
    });
}

async function executeTestHealth(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<void> {
    const input = interaction.options.getString('title', true);
    const channel = interaction.options.getChannel('channel', false);
    const anime = await resolveAnime(input);
    if (!anime) {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No anime found for \`${input}\`.`, nl: `Geen anime gevonden voor \`${input}\`.` }), flags: MessageFlags.Ephemeral });
        return;
    }

    const manager = getConfigManager().animeManager.subscriptions;
    let subscription: AnimeSubscriptionRecord | null;
    let targetDescription: string;

    if (channel) {
        if (!(await requireAdmin(interaction))) return;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: resolveLocaleValue(locale, { en: 'Channel subscriptions can only be inspected in a server.', nl: 'Kanaalabonnementen kunnen alleen op een server worden gecontroleerd.' }), flags: MessageFlags.Ephemeral });
            return;
        }
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'channel',
            guildId,
            channelId: channel.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = resolveLocaleValue(locale, { en: `<#${channel.id}> reminders`, nl: `meldingen in <#${channel.id}>` });
    } else {
        subscription = await manager.getOnePlain({
            anilistId: anime.id,
            targetType: 'dm',
            userId: interaction.user.id,
        }) as unknown as AnimeSubscriptionRecord | null;
        targetDescription = resolveLocaleValue(locale, { en: 'your DM reminders', nl: 'je DM-meldingen' });
    }

    if (!subscription?.id) {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: `No matching subscription found for **${formatAnimeTitle(anime, locale)}**.`, nl: `Geen overeenkomend abonnement gevonden voor **${formatAnimeTitle(anime, locale)}**.` }), flags: MessageFlags.Ephemeral });
        return;
    }

    const health = await getConfigManager().integrationHealthManager.getForConfig('anime', subscription.id);
    if (!health) {
        await interaction.reply({
            content: resolveLocaleValue(locale, { en: `No health record has been recorded yet for ${targetDescription} for **${formatAnimeTitle(anime, locale)}**. The next worker poll will populate it.`, nl: `Er is nog geen status vastgelegd voor ${targetDescription} voor **${formatAnimeTitle(anime, locale)}**. De volgende controle vult deze in.` }),
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
    const names = resolveLocaleValue(locale, {
        en: { WINTER: 'WINTER', SPRING: 'SPRING', SUMMER: 'SUMMER', FALL: 'FALL' },
        nl: { WINTER: 'Winter', SPRING: 'Lente', SUMMER: 'Zomer', FALL: 'Herfst' },
    } satisfies OutputLocaleValues<Readonly<Record<AniListSeason, string>>>);
    return names[season];
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
    await interaction.reply({ content: resolveLocaleValue(locale, { en: 'Unknown anime subcommand.', nl: 'Onbekende anime-subopdracht.' }), flags: MessageFlags.Ephemeral });
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
            content: resolveLocaleValue(locale, { en: `${created ? 'Subscribed you' : 'You are already subscribed'} to **${anime ? formatAnimeTitle(anime, locale) : `AniList #${anilistId}`}**. Use \`/anime list\` to view or unsubscribe.`, nl: `${created ? 'Je bent geabonneerd' : 'Je bent al geabonneerd'} op **${anime ? formatAnimeTitle(anime, locale) : `AniList #${anilistId}`}**. Gebruik \`/anime list\` om je abonnementen te bekijken of op te zeggen.` }),
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
            await interaction.reply({ content: resolveLocaleValue(locale, { en: 'That subscription is already gone.', nl: 'Dat abonnement bestaat niet meer.' }), flags: MessageFlags.Ephemeral });
            return true;
        }
        await interaction.update({
            content: resolveLocaleValue(locale, { en: `Unsubscribed from AniList #${anilistId}.`, nl: `Abonnement op AniList #${anilistId} opgezegd.` }),
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
        resolveLocaleValue(locale, { en: `${copy.latestHealth} for ${targetDescription} for **${title}**:`, nl: `${copy.latestHealth} van ${targetDescription} voor **${title}**:` }),
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
    const labels: Readonly<Record<string, string>> = resolveLocaleValue(locale, {
        en: {},
        nl: {
            healthy: 'gezond', success: 'geslaagd', warning: 'waarschuwing', error: 'fout',
            failed: 'mislukt', paused: 'gepauzeerd', unknown: 'onbekend',
        },
    } satisfies OutputLocaleValues<Readonly<Record<string, string>>>);
    return labels[status] ?? status;
}

function formatHealthDate(value: Date | string | null | undefined, locale: SupportedOutputLocale): string {
    if (!value) return resolveLocaleValue(locale, { en: 'Never', nl: 'Nooit' });
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
