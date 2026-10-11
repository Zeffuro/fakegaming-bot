import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction } from 'discord.js';
import { PollError, validRanking, type PollBoard } from '@zeffuro/fakegaming-common/managers';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { getGeneralCopy } from '../data/generalCopy.js';
import type { PollRuntime } from './pollRuntime.js';

export function rankedBallot(board: PollBoard, owner: string, ranking: readonly number[], locale = board.locale) {
    const copy = getGeneralCopy(locale).poll;
    const id = (action: string) => `poll:r:${board.id}:${owner}:${board.messageId}:${ranking.join('')}:${action}`;
    const choices = board.options.map((option, index) => new ButtonBuilder()
        .setCustomId(id(String(index))).setLabel(`${index + 1}. ${option.slice(0, 72)}`)
        .setStyle(ButtonStyle.Primary).setDisabled(ranking.includes(index)));
    const controls = [
        new ButtonBuilder().setCustomId(id('u')).setLabel(copy.rankUndo).setStyle(ButtonStyle.Secondary).setDisabled(!ranking.length),
        new ButtonBuilder().setCustomId(id('s')).setLabel(copy.rankSubmit).setStyle(ButtonStyle.Success).setDisabled(!ranking.length),
    ];
    return {
        content: [`**${board.question}**`, copy.rankInstructions,
            ranking.length ? ranking.map((option, index) => `${index + 1}. ${board.options[option]}`).join('\n') : copy.rankEmpty].join('\n\n'),
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...choices), new ActionRowBuilder<ButtonBuilder>().addComponents(...controls)],
        allowedMentions: { parse: [] as [] },
    };
}

export async function handleRankedBallot(interaction: ButtonInteraction, runtime: Pick<PollRuntime, 'manager' | 'track'>): Promise<boolean> {
    const parts = interaction.customId.split(':');
    const locale = await resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
    const copy = getGeneralCopy(locale).poll;
    const reply = async (content: string) => {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return true;
    };
    try {
        const opening = parts[1] === 'rank';
        const owner = opening ? interaction.user.id : parts[3];
        const messageId = opening ? interaction.message.id : parts[4];
        if (owner !== interaction.user.id || !messageId || !parts[2]
            || (opening ? parts.length < 3 || parts.length > 4 : parts.length !== 7)) return reply(copy.unavailable);
        const scope = { guildId: interaction.guildId ?? `dm:${interaction.user.id}`, channelId: interaction.channelId, messageId };
        const board = await runtime.manager.get(parts[2], scope);
        if (!board?.ranked) return reply(copy.unavailable);
        if (board.closedAt !== null) return reply(copy.closed);
        const ranking = opening ? [...(board.votes.get(owner) ?? [])] : [...(parts[5] ?? '')].map(Number);
        if (!opening && (!/^[0-4]{0,5}$/.test(parts[5] ?? '') || (ranking.length && !validRanking(ranking, board.options.length)))) return reply(copy.unavailable);
        if (opening) {
            await interaction.followUp({ ...rankedBallot(board, owner, ranking, locale), flags: MessageFlags.Ephemeral });
        } else if (parts[6] === 's') {
            if (!validRanking(ranking, board.options.length)) return reply(copy.unavailable);
            const updated = await runtime.manager.rank(board.id, scope, owner, ranking);
            runtime.track(updated);
            await interaction.editReply({ content: copy.rankSaved, components: [], allowedMentions: { parse: [] } });
        } else {
            if (parts[6] === 'u') ranking.pop();
            else {
                if (!/^[0-4]$/.test(parts[6] ?? '')) return reply(copy.unavailable);
                const choice = Number(parts[6]);
                if (choice >= board.options.length || ranking.includes(choice)) return reply(copy.unavailable);
                ranking.push(choice);
            }
            await interaction.editReply(rankedBallot(board, owner, ranking, locale));
        }
        return true;
    } catch (error) {
        return reply(error instanceof PollError && error.code === 'closed' ? copy.closed : copy.failure);
    }
}
