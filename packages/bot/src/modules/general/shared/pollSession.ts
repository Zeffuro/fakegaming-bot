import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { countRankedPoll, type PollBoard } from '@zeffuro/fakegaming-common/managers';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { encodeComponentLocale } from '../../../core/componentLocale.js';
import { getGeneralCopy } from '../data/generalCopy.js';

export interface PollMessagePayload {
    content: string;
    components: ActionRowBuilder<ButtonBuilder>[];
    allowedMentions: { parse: [] };
}

export function renderPollMessage(session: PollBoard): PollMessagePayload {
    const copy = getGeneralCopy(session.locale).poll;
    const counts = optionCounts(session);
    const totalVotes = session.votes.size;
    const closed = session.closedAt !== null;
    const hidden = session.hideResults && !closed;
    const lines = [
        `**${session.question}**`,
        closed
            ? session.closeReason === 'expired'
                ? copy.closedByExpiry
                : session.closeReason === 'moderator' ? copy.closedByModerator : copy.closedByCreator
            : copy.closes(Math.floor(session.expiresAt / 1_000)),
        '',
        ...session.options.map((option, index) => {
            if (hidden) return `${index + 1}. ${option}`;
            const count = counts[index] ?? 0;
            const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
            return `${index + 1}. ${option} - ${copy.votes(count)} (${percentage}%)`;
        }),
        '',
        hidden ? copy.resultsHidden : copy.total(totalVotes),
        session.ranked ? copy.rankedVoting : session.allowMultiple ? copy.multipleVoting : copy.singleVoting,
    ];

    if (closed) lines.push(session.ranked ? formatRankedResult(session) : formatResult(session, counts));

    return {
        content: lines.join('\n'),
        components: pollComponents(session.id, session.options, closed, session.locale, session.ranked),
        allowedMentions: { parse: [] },
    };
}

export function pollComponents(
    pollId: string,
    options: readonly string[],
    disabled: boolean,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
    ranked = false,
): ActionRowBuilder<ButtonBuilder>[] {
    const optionButtons = options.map((option, index) => new ButtonBuilder()
        .setCustomId(`poll:vote:${pollId}:${index}${encodeComponentLocale(locale)}`)
        .setLabel(`${index + 1}. ${truncateButtonLabel(option)}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled));
    const closeButton = new ButtonBuilder()
        .setCustomId(`poll:close:${pollId}${encodeComponentLocale(locale)}`)
        .setLabel(getGeneralCopy(locale).poll.closeButton)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(...(ranked ? [new ButtonBuilder()
            .setCustomId(`poll:rank:${pollId}${encodeComponentLocale(locale)}`).setLabel(getGeneralCopy(locale).poll.rankButton)
            .setStyle(ButtonStyle.Primary).setDisabled(disabled)] : optionButtons)),
        new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton),
    ];
}

function optionCounts(session: PollBoard): number[] {
    const counts = Array.from({ length: session.options.length }, () => 0);
    for (const selections of session.votes.values()) {
        for (const optionIndex of session.ranked ? selections.slice(0, 1) : selections) counts[optionIndex] = (counts[optionIndex] ?? 0) + 1;
    }
    return counts;
}

function formatRankedResult(session: PollBoard): string {
    const copy = getGeneralCopy(session.locale).poll;
    const result = countRankedPoll(session.options.length, session.votes.values());
    if (result.status === 'no-votes') return copy.noVotes;
    const final = result.rounds.at(-1)!;
    const names = result.winners.map(index => `**${shortResultName(session.options[index] ?? '')}**`).join(', ');
    return [result.status === 'winner' ? copy.winner(shortResultName(session.options[result.winners[0]!] ?? ''), final.counts[result.winners[0]!] ?? 0) : copy.rankTie(names),
        ...result.rounds.map((round, index) => copy.rankRound(index + 1, round.active.map(option => `${option + 1}: ${round.counts[option] ?? 0}`).join(', '), round.exhausted))].join('\n');
}

function formatResult(session: PollBoard, counts: readonly number[]): string {
    const copy = getGeneralCopy(session.locale).poll;
    const highestCount = Math.max(...counts);
    if (highestCount === 0) return copy.noVotes;

    const winners = session.options.filter((_option, index) => counts[index] === highestCount);
    if (winners.length === 1) return copy.winner(shortResultName(winners[0] ?? ''), highestCount);
    return copy.tie(winners.map(winner => `**${shortResultName(winner)}**`).join(', '), highestCount);
}

function shortResultName(option: string): string {
    return option.length <= 60 ? option : `${option.slice(0, 57)}...`;
}

function truncateButtonLabel(option: string): string {
    return option.length <= 72 ? option : `${option.slice(0, 69)}...`;
}
