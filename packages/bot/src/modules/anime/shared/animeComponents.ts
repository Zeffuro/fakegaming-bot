import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { AniListSeason, AniListSeasonScope } from '@zeffuro/fakegaming-common/anime';

const MAX_BUTTONS_PER_ROW = 5;
const MAX_RESULT_BUTTONS = 10;

export function buildAnimeSubscribeCustomId(anilistId: number): string {
    return `anime:subscribe:${anilistId}`;
}

export function buildAnimeUnsubscribeCustomId(anilistId: number): string {
    return `anime:unsubscribe:${anilistId}`;
}

export function buildAnimeListPageCustomId(page: number): string {
    return `anime:list:${page}`;
}

export function buildAnimeSeasonPageCustomId(season: AniListSeason, year: number, page: number, scope: AniListSeasonScope): string {
    return `anime:season:${scope}:${season}:${year}:${page}`;
}

export function buildAnimeActionRow(anilistId: number): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildAnimeSubscribeCustomId(anilistId))
            .setLabel('Subscribe')
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

export function buildAnimeSearchActionRows(anilistIds: number[], startIndex = 0): ActionRowBuilder<ButtonBuilder>[] {
    const buttons = anilistIds.slice(0, MAX_RESULT_BUTTONS).map((id, index) =>
        new ButtonBuilder()
            .setCustomId(buildAnimeSubscribeCustomId(id))
            .setLabel(`Subscribe #${startIndex + index + 1}`)
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
}): ActionRowBuilder<ButtonBuilder>[] {
    const startIndex = args.startIndex ?? 0;
    const unsubscribeRows = chunkButtons(args.anilistIds.slice(0, MAX_RESULT_BUTTONS).map((id, index) =>
        new ButtonBuilder()
            .setCustomId(buildAnimeUnsubscribeCustomId(id))
            .setLabel(`Unsubscribe #${startIndex + index + 1}`)
            .setStyle(ButtonStyle.Danger)
    ));

    const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildAnimeListPageCustomId(Math.max(1, args.page - 1)))
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasPrevious),
        new ButtonBuilder()
            .setCustomId(buildAnimeListPageCustomId(args.page + 1))
            .setLabel('Next')
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
}): ActionRowBuilder<ButtonBuilder>[] {
    const subscribeRows = buildAnimeSearchActionRows(args.anilistIds, args.startIndex);
    const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildAnimeSeasonPageCustomId(args.season, args.year, Math.max(1, args.page - 1), args.scope))
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasPrevious),
        new ButtonBuilder()
            .setCustomId(buildAnimeSeasonPageCustomId(args.season, args.year, args.page + 1, args.scope))
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!args.hasNext),
    );
    return [...subscribeRows, navigation];
}
