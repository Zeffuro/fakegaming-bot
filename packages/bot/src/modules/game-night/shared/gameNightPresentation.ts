import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    escapeMarkdown,
    type MessageMentionOptions,
} from 'discord.js';
import type { GameNightBoard } from '@zeffuro/fakegaming-common/managers';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { encodeComponentLocale } from '../../../core/componentLocale.js';
import { getGameNightCopy } from '../copy/gameNightCopy.js';

export interface GameNightMessage {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
    allowedMentions: MessageMentionOptions;
}

export function renderGameNightBoard(board: GameNightBoard, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): GameNightMessage {
    const gameNightCopy = getGameNightCopy(locale);
    const safeName = escapeMarkdown(board.session.name);
    const lines = [
        gameNightCopy.title(board.session.kind, safeName),
        gameNightCopy.host(board.session.creatorId),
        board.session.allowMultipleNominations
            ? gameNightCopy.multipleNominationsEnabled
            : gameNightCopy.multipleNominationsLimited,
        stateLine(board, locale),
        gameNightCopy.expiry(Math.floor(board.session.expiresAt / 1_000)),
        '',
        gameNightCopy.nominationHeading,
    ];
    if (board.nominations.length === 0) lines.push(gameNightCopy.noNominations);
    else {
        for (const [index, nomination] of board.nominations.entries()) {
            const game = escapeMarkdown(nomination.gameName);
            lines.push(board.session.state === 'nominating'
                ? gameNightCopy.nominationLine(index + 1, game)
                : gameNightCopy.voteLine(index + 1, game, nomination.voteCount));
        }
    }

    const winner = board.nominations.find(item => item.id === board.session.winnerNominationId);
    if (winner) lines.push('', gameNightCopy.tonight(escapeMarkdown(winner.gameName)));
    if (board.session.tieBreakCandidateIds.length > 1) {
        const candidates = board.session.tieBreakCandidateIds
            .map(id => board.nominations.find(item => item.id === id))
            .filter(item => item !== undefined)
            .map(item => `**${escapeMarkdown(item.gameName)}**`);
        lines.push(gameNightCopy.tieResolved(candidates.join(', ')));
    }

    return {
        content: lines.join('\n'),
        components: componentRows(board, locale),
        allowedMentions: { parse: [] },
    };
}

function stateLine(board: GameNightBoard, locale: SupportedOutputLocale): string {
    const gameNightCopy = getGameNightCopy(locale);
    if (board.session.state === 'nominating') return gameNightCopy.nominatingState;
    if (board.session.state === 'voting') return gameNightCopy.votingState;
    if (board.session.state === 'finished') return gameNightCopy.finishedState;
    return gameNightCopy.expiredState;
}

function componentRows(board: GameNightBoard, locale: SupportedOutputLocale): ActionRowBuilder<ButtonBuilder>[] {
    const gameNightCopy = getGameNightCopy(locale);
    if (board.session.state === 'nominating') {
        return [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`game-night:open:${board.session.id}${encodeComponentLocale(locale)}`)
                .setLabel(gameNightCopy.openVotingButton)
                .setStyle(ButtonStyle.Primary),
        )];
    }
    if (board.session.state === 'voting') {
        const voteRow = new ActionRowBuilder<ButtonBuilder>();
        for (const [index, nomination] of board.nominations.entries()) {
            voteRow.addComponents(new ButtonBuilder()
                .setCustomId(`game-night:vote:${board.session.id}:${nomination.id}${encodeComponentLocale(locale)}`)
                .setLabel(String(index + 1))
                .setStyle(ButtonStyle.Secondary));
        }
        return [
            voteRow,
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`game-night:close:${board.session.id}${encodeComponentLocale(locale)}`)
                    .setLabel(gameNightCopy.pickWinnerButton)
                    .setStyle(ButtonStyle.Success),
            ),
        ];
    }
    return [];
}
