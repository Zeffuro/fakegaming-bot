import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { AniListSeason, AniListSeasonScope } from '@zeffuro/fakegaming-common/anime';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { encodeComponentLocale } from '../../../core/componentLocale.js';
import { getAnimeCopy } from '../copy/animeCopy.js';

const MAX_BUTTONS_PER_ROW = 5;
const MAX_RESULT_BUTTONS = 10;

export function buildAnimeSubscribeCustomId(anilistId: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return `anime:subscribe:${anilistId}${encodeComponentLocale(locale)}`;
}

export function buildAnimeUnsubscribeCustomId(anilistId: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return `anime:unsubscribe:${anilistId}${encodeComponentLocale(locale)}`;
}

export function buildAnimeListPageCustomId(page: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return `anime:list:${page}${encodeComponentLocale(locale)}`;
}

export function buildAnimeSeasonPageCustomId(
    season: AniListSeason,
    year: number,
    page: number,
    scope: AniListSeasonScope,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    return `anime:season:${scope}:${season}:${year}:${page}${encodeComponentLocale(locale)}`;
}

export function buildAnimeActionRow(anilistId: number, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): ActionRowBuilder<ButtonBuilder> {
    const copy = getAnimeCopy(locale);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildAnimeSubscribeCustomId(anilistId, locale))
            .setLabel(copy.subscribe)
            .setStyle(ButtonStyle.Primary),
    );
}

function chunkButtons(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + MAX_BUTTONS_PER_ROW)));
    }
    return rows;
}

export function buildAnimeSearchActionRows(
    anilistIds: number[],
    startIndex = 0,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): ActionRowBuilder<ButtonBuilder>[] {
    const copy = getAnimeCopy(locale);
    const buttons = anilistIds.slice(0, MAX_RESULT_BUTTONS).map((id, index) =>
        new ButtonBuilder()
            .setCustomId(buildAnimeSubscribeCustomId(id, locale))
            .setLabel(`${copy.subscribe} #${startIndex + index + 1}`)
            .setStyle(ButtonStyle.Primary)
    );
    return chunkButtons(buttons);
}

export function buildAnimeListActionRows(args: {
    anilistIds: number[];
    page: number;
    hasPrevious: boolean;
    hasNext: boolean;
    startIndex?: number;
    locale?: SupportedOutputLocale;
}): ActionRowBuilder<ButtonBuilder>[] {
    const locale = args.locale ?? DEFAULT_OUTPUT_LOCALE;
    const copy = getAnimeCopy(locale);
    const startIndex = args.startIndex ?? 0;
    const unsubscribeRows = chunkButtons(args.anilistIds.slice(0, MAX_RESULT_BUTTONS).map((id, index) =>
        new ButtonBuilder()
            .setCustomId(buildAnimeUnsubscribeCustomId(id, locale))
            .setLabel(`${copy.unsubscribe} #${startIndex + index + 1}`)
            .setStyle(ButtonStyle.Danger)
    ));

    const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildAnimeListPageCustomId(Math.max(1, args.page - 1), locale))
            .setLabel(copy.previous)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasPrevious),
        new ButtonBuilder()
            .setCustomId(buildAnimeListPageCustomId(args.page + 1, locale))
            .setLabel(copy.nextButton)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasNext),
    );

    return [...unsubscribeRows, navigation];
}

export function buildAnimeSeasonActionRows(args: {
    anilistIds: number[];
    season: AniListSeason;
    year: number;
    page: number;
    scope: AniListSeasonScope;
    hasPrevious: boolean;
    hasNext: boolean;
    startIndex?: number;
    locale?: SupportedOutputLocale;
}): ActionRowBuilder<ButtonBuilder>[] {
    const locale = args.locale ?? DEFAULT_OUTPUT_LOCALE;
    const copy = getAnimeCopy(locale);
    const subscribeRows = buildAnimeSearchActionRows(args.anilistIds, args.startIndex, locale);
    const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildAnimeSeasonPageCustomId(args.season, args.year, Math.max(1, args.page - 1), args.scope, locale))
            .setLabel(copy.previous)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasPrevious),
        new ButtonBuilder()
            .setCustomId(buildAnimeSeasonPageCustomId(args.season, args.year, args.page + 1, args.scope, locale))
            .setLabel(copy.nextButton)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasNext),
    );
    return [...subscribeRows, navigation];
}
