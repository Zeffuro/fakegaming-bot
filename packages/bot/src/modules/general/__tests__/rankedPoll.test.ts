import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { getConfigManager, PollError, type PollBoard } from '@zeffuro/fakegaming-common/managers';
import { createPollComponentHandler } from '../commands/poll.js';
import { rankedBallot } from '../shared/rankedBallot.js';
import { renderPollMessage } from '../shared/pollSession.js';
import { getGeneralCopy } from '../data/generalCopy.js';

const scope = { guildId: 'guild', channelId: 'channel', messageId: '12345678901234567890' };
const owner = '22345678901234567890';
const board: PollBoard = { ...scope, id: '12345678-1234-1234-1234-123456789012', creatorId: 'creator',
    question: 'Choose?', options: ['A', 'B', 'C'], votes: new Map(), allowMultiple: false, hideResults: false, ranked: true,
    locale: 'en', expiresAt: Date.now() + 60_000, closedAt: null, closeReason: null, renderPending: true, version: 0 };
function interaction(customId: string, user = owner, messageId = 'private-message') {
    return { customId, guildId: scope.guildId, channelId: scope.channelId, locale: 'en-US', user: { id: user }, message: { id: messageId },
        deferUpdate: vi.fn().mockResolvedValue(undefined), followUp: vi.fn().mockResolvedValue(undefined), editReply: vi.fn().mockResolvedValue(undefined) };
}
function runtime(current = board) {
    return { manager: { get: vi.fn().mockResolvedValue(current), rank: vi.fn().mockResolvedValue(current), vote: vi.fn(), close: vi.fn() }, track: vi.fn(), refresh: vi.fn() };
}
beforeEach(() => {
    vi.spyOn(getConfigManager().userManager, 'getUser').mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe('private ranked poll ballots', () => {
    it('opens privately and stages exact order without recording a vote until submit', async () => {
        const state = runtime(); const handler = createPollComponentHandler(state as unknown as Parameters<typeof createPollComponentHandler>[0]);
        const opening = interaction(`poll:rank:${board.id}:en`, owner, board.messageId);
        await handler(opening as unknown as ButtonInteraction);
        expect(opening.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
        const draft = rankedBallot(board, owner, [2, 0]);
        const ids = draft.components.flatMap(row => row.components).map(component => (component.toJSON() as { custom_id: string }).custom_id);
        expect(ids.every(id => id.length <= 100)).toBe(true);
        const undo = interaction(ids.at(-2)!); await handler(undo as unknown as ButtonInteraction);
        expect(state.manager.rank).not.toHaveBeenCalled();
        expect(undo.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('1. C') }));
        const submit = interaction(ids.at(-1)!);
        await createPollComponentHandler(state as unknown as Parameters<typeof createPollComponentHandler>[0])(submit as unknown as ButtonInteraction);
        expect(state.manager.get).toHaveBeenLastCalledWith(board.id, scope);
        expect(state.manager.rank).toHaveBeenCalledWith(board.id, scope, owner, [2, 0]);
        expect(submit.editReply).toHaveBeenCalledWith(expect.objectContaining({ components: [], content: getGeneralCopy('en').poll.rankSaved }));
    });
    it('binds draft to owner and original channel/message and rejects malformed rankings', async () => {
        const state = runtime(); const handler = createPollComponentHandler(state as unknown as Parameters<typeof createPollComponentHandler>[0]);
        const id = (rankedBallot(board, owner, [2, 0]).components[1]!.components[1]!.toJSON() as { custom_id: string }).custom_id;
        await handler(interaction(id, 'other') as unknown as ButtonInteraction); expect(state.manager.get).not.toHaveBeenCalled();
        for (const bad of [id.replace(':20:s', ':22:s'), id.replace(':20:s', ':9:s'), id.replace(':20:s', '::s')]) {
            await handler(interaction(bad) as unknown as ButtonInteraction);
        }
        expect(state.manager.rank).not.toHaveBeenCalled();
        state.manager.get.mockResolvedValueOnce(null);
        const foreign = { ...interaction(id), channelId: 'foreign' }; await handler(foreign as unknown as ButtonInteraction);
        expect(state.manager.get).toHaveBeenLastCalledWith(board.id, { ...scope, channelId: 'foreign' });
        expect(foreign.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: getGeneralCopy('en').poll.unavailable }));
    });
    it('rechecks close at submit and keeps stored ballot unchanged while rendering failures are private', async () => {
        const state = runtime(); const handler = createPollComponentHandler(state as unknown as Parameters<typeof createPollComponentHandler>[0]);
        const id = (rankedBallot(board, owner, [1]).components[1]!.components[1]!.toJSON() as { custom_id: string }).custom_id;
        state.manager.rank.mockRejectedValueOnce(new PollError('closed'));
        const submit = interaction(id); await handler(submit as unknown as ButtonInteraction);
        expect(submit.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: getGeneralCopy('en').poll.closed }));
        expect(state.track).not.toHaveBeenCalled();
        state.manager.get.mockResolvedValueOnce({ ...board, closedAt: 1 });
        await handler(interaction(id) as unknown as ButtonInteraction); expect(state.manager.rank).toHaveBeenCalledOnce();
    });
    it('hides all ranked counts while open and reveals winner, exhaustion and round results in both locales', () => {
        for (const locale of ['en', 'nl'] as const) {
            const session = { ...board, locale, hideResults: true, votes: new Map([['a', [0]], ['b', [0]], ['c', [0]], ['d', [1]], ['e', [1]], ['f', [2]]]) };
            const copy = getGeneralCopy(locale).poll;
            const open = renderPollMessage(session); expect(open.content).toContain(copy.resultsHidden);
            expect(open.content).not.toContain(copy.total(6)); expect(open.content).not.toMatch(/\d+%/);
            const closed = renderPollMessage({ ...session, closedAt: 1 });
            expect(closed.content).toContain(copy.winner('A', 3));
            expect(closed.content).toContain(copy.rankRound(2, '1: 3, 2: 2', 1));
            const long = renderPollMessage({ ...session, question: 'Q'.repeat(200), options: ['A', 'B', 'C'].map(value => value.repeat(200)), closedAt: 1 });
            expect(long.content.length).toBeLessThanOrEqual(2000);
            const tied = renderPollMessage({ ...session, question: 'Q'.repeat(200), options: Array.from({ length: 5 }, (_, index) => `${index}${'O'.repeat(199)}`),
                votes: new Map(Array.from({ length: 5 }, (_, index) => [String(index), [index]])), closedAt: 1 });
            expect(tied.content).toContain(locale === 'en' ? 'unresolved tie' : 'onbeslist');
            expect(tied.content.length).toBeLessThanOrEqual(2000);
        }
    });
});
