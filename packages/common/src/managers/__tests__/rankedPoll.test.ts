import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollSession } from '../../models/poll-session.js';
import { PollTemplate } from '../../models/poll-template.js';
import { PollManager, countRankedPoll } from '../pollManager.js';
import { PollTemplateManager } from '../pollTemplateManager.js';

const scope = { guildId: 'guild', channelId: 'channel', messageId: 'message' };
const input = { ...scope, creatorId: 'creator', question: 'Choose?', options: ['A', 'B', 'C'], ranked: true };
beforeEach(async () => { await PollSession.destroy({ where: {} }); await PollTemplate.destroy({ where: {} }); });

describe('instant runoff', () => {
    it('transfers preferences over multiple rounds and requires a strict majority', () => {
        const result = countRankedPoll(4, [[0], [0], [0], [0], [1], [1], [1], [2, 1], [2, 1], [3, 1]]);
        expect(result).toMatchObject({ status: 'winner' }); expect(result.winners).toEqual([1]);
        expect(result.rounds.map(round => round.counts)).toEqual([[4, 3, 2, 1], [4, 4, 2, 0], [4, 6, 0, 0]]);
    });
    it('stops at an elimination tie instead of choosing arbitrarily', () => {
        const result = countRankedPoll(3, [[0], [0], [1], [2]]);
        expect(result).toMatchObject({ status: 'tie', winners: [0, 1, 2] });
        expect(result.rounds[0]).toMatchObject({ continuing: 4, eliminated: null });
    });
    it('counts exhausted partial ballots outside the majority denominator', () => {
        const result = countRankedPoll(3, [[0], [0], [0], [1], [1], [2]]);
        expect(result).toMatchObject({ status: 'winner' }); expect(result.winners).toEqual([0]);
        expect(result.rounds).toHaveLength(2);
        expect(result.rounds[1]).toMatchObject({ counts: [3, 2, 0], continuing: 5, exhausted: 1 });
    });
    it('handles first-round wins, no votes and rejects invalid ballots', () => {
        expect(countRankedPoll(2, [[1], [1], [0]])).toMatchObject({ status: 'winner', winners: [1] });
        expect(countRankedPoll(2, [])).toEqual({ status: 'no-votes', winners: [], rounds: [] });
        for (const ballot of [[], [0, 0], [2], [-1], [0.5], [0, 1, 2]]) expect(() => countRankedPoll(2, [ballot])).toThrow();
        expect(() => countRankedPoll(1, [[0]])).toThrow();
    });
});

describe('persistent ranked ballots', () => {
    it('stores exact order, permits partial revisions and survives restart without changing another voter', async () => {
        const polls = new PollManager(); const board = await polls.create(input);
        await polls.rank(board.id, scope, 'one', [2, 0, 1]); await polls.rank(board.id, scope, 'two', [1]);
        await new PollManager().rank(board.id, scope, 'one', [0, 2]);
        expect((await new PollManager().get(board.id))?.votes).toEqual(new Map([['one', [0, 2]], ['two', [1]]]));
        expect((await new PollManager().get(board.id))?.ranked).toBe(true);
        await expect(polls.vote(board.id, scope, 'one', 1)).rejects.toMatchObject({ code: 'invalid-input' });
    });
    it('rejects malformed, foreign scope, closed and expired submissions and preserves failed writes', async () => {
        let now = 1_000; const polls = new PollManager({ now: () => now }); const board = await polls.create({ ...input, durationMinutes: 1 });
        for (const invalid of [[], [0, 0], [3], [-1], [0.5]]) await expect(polls.rank(board.id, scope, 'one', invalid)).rejects.toMatchObject({ code: 'invalid-input' });
        for (const field of ['guildId', 'channelId', 'messageId']) await expect(polls.rank(board.id, { ...scope, [field]: 'foreign' }, 'one', [0])).rejects.toMatchObject({ code: 'missing' });
        await polls.rank(board.id, scope, 'one', [2, 0]);
        const update = vi.spyOn(PollSession.prototype, 'update').mockRejectedValueOnce(new Error('offline'));
        try { await expect(polls.rank(board.id, scope, 'one', [1])).rejects.toThrow('offline'); } finally { update.mockRestore(); }
        expect((await polls.get(board.id))?.votes.get('one')).toEqual([2, 0]);
        now = 61_001; await expect(polls.rank(board.id, scope, 'one', [1])).rejects.toMatchObject({ code: 'closed' });
        expect((await new PollManager({ now: () => now }).get(board.id))?.votes.get('one')).toEqual([2, 0]);
    });
    it('defaults legacy behavior off and rejects incompatible modes and non-ranked submissions', async () => {
        const polls = new PollManager(); const old = await polls.create({ ...input, ranked: undefined });
        expect(old.ranked).toBe(false); await polls.vote(old.id, scope, 'one', 0);
        await expect(polls.rank(old.id, scope, 'one', [1])).rejects.toMatchObject({ code: 'invalid-input' });
        await expect(polls.create({ ...input, allowMultiple: true })).rejects.toMatchObject({ code: 'invalid-input' });
    });
    it('rejects persisted malformed ranked ballots and serializes submit after closure', async () => {
        const polls = new PollManager(); const original = await polls.create(input);
        const settled = await Promise.allSettled([polls.close(original.id, scope, 'creator'), polls.rank(original.id, scope, 'one', [1])]);
        expect(settled[0]?.status).toBe('fulfilled'); expect(settled[1]).toMatchObject({ status: 'rejected', reason: { code: 'closed' } });
        await PollSession.update({ votesJson: '[["one",[]]]' }, { where: { id: original.id } });
        await expect(new PollManager().get(original.id)).rejects.toThrow('Invalid persisted poll');
    });
    it('preserves concurrent votes across managers and locks ranked submissions against closure', async () => {
        const first = new PollManager(); const second = new PollManager(); const board = await first.create(input);
        await Promise.all([first.rank(board.id, scope, 'one', [2, 1]), second.rank(board.id, scope, 'two', [0])]);
        expect((await first.get(board.id))?.votes).toEqual(new Map([['one', [2, 1]], ['two', [0]]]));
        const find = PollSession.findOne.bind(PollSession);
        const lookup = vi.spyOn(PollSession, 'findOne').mockImplementationOnce(async options => {
            expect(options?.transaction).toBeDefined(); expect(options?.lock).toBe('UPDATE');
            return find(options);
        });
        try {
            const outcomes = await Promise.allSettled([first.close(board.id, scope, 'creator'), second.rank(board.id, scope, 'one', [1])]);
            expect(outcomes[0]?.status).toBe('fulfilled'); expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'closed' } });
        } finally { lookup.mockRestore(); }
        expect((await second.get(board.id))?.votes).toEqual(new Map([['one', [2, 1]], ['two', [0]]]));
        const plain = await first.create({ ...input, ranked: false, messageId: 'plain' }); const plainScope = { ...scope, messageId: 'plain' };
        await Promise.all([first.vote(plain.id, plainScope, 'one', 0), second.vote(plain.id, plainScope, 'two', 1)]);
        expect((await second.get(plain.id))?.votes.size).toBe(2);
    });
    it('copies the exact ranked setting into independent fresh polls and guards template changes', async () => {
        const polls = new PollManager(); const templates = new PollTemplateManager(); const original = await polls.create(input);
        await polls.rank(original.id, scope, 'one', [2, 1]);
        const saved = await templates.savePoll('creator', original.id, 'Saved'); expect(saved.ranked).toBe(true);
        const fresh = await templates.start(saved.id, 'creator', 0, polls, { ...scope, messageId: 'fresh' });
        expect(fresh.ranked).toBe(true); expect(fresh.votes.size).toBe(0);
        await templates.edit(saved.id, 'creator', 0, { ...saved, ranked: false, allowMultiple: true });
        expect((await polls.get(fresh.id))?.ranked).toBe(true);
        await expect(templates.start(saved.id, 'creator', 0, polls, scope)).rejects.toMatchObject({ code: 'stale' });
        await expect(templates.create('creator', { ...saved, allowMultiple: true })).rejects.toMatchObject({ code: 'invalid' });
    });
});
