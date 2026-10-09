import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollSession } from '../../models/poll-session.js';
import { PollManager, POLL_RETENTION_MS } from '../pollManager.js';

const scope = { guildId: 'guild', channelId: 'channel', messageId: 'message' };
const input = { ...scope, creatorId: 'creator', question: 'Choose?', options: ['Alpha', 'Beta'], durationMinutes: 1 };

beforeEach(async () => {
    await PollSession.destroy({ where: {} });
});

describe('persistent polls', () => {
    it('restores binding, locale, vote changes and final results through a fresh manager', async () => {
        const first = new PollManager();
        const board = await first.create({ ...input, locale: 'nl' });
        await first.vote(board.id, scope, 'one', 0);
        await first.vote(board.id, scope, 'one', 1);
        await first.vote(board.id, scope, 'two', 0);
        const restarted = new PollManager();
        const restored = await restarted.get(board.id, scope);
        expect(restored).toMatchObject({ ...scope, locale: 'nl', allowMultiple: false, closedAt: null });
        expect(restored?.votes).toEqual(new Map([['one', [1]], ['two', [0]]]));
        const closed = await restarted.close(board.id, scope, 'creator');
        await expect(first.vote(board.id, scope, 'three', 0)).rejects.toMatchObject({ code: 'closed' });
        const final = await new PollManager().get(board.id, scope);
        expect(final?.votes).toEqual(closed.votes);
        expect(final).toMatchObject({ closedAt: closed.closedAt, closeReason: 'creator' });
    });

    it('toggles multiple selections independently and removes users with no selections', async () => {
        const manager = new PollManager();
        const board = await manager.create({ ...input, allowMultiple: true });
        await Promise.all([manager.vote(board.id, scope, 'one', 0), manager.vote(board.id, scope, 'one', 1)]);
        expect((await manager.get(board.id))?.votes.get('one')).toEqual([0, 1]);
        await manager.vote(board.id, scope, 'one', 0);
        expect((await new PollManager().get(board.id))?.votes.get('one')).toEqual([1]);
        await manager.vote(board.id, scope, 'one', 1);
        expect((await manager.get(board.id))?.votes.size).toBe(0);
    });

    it('serializes same-user votes and close races without modifying final votes', async () => {
        const manager = new PollManager();
        const board = await manager.create(input);
        await Promise.all([manager.vote(board.id, scope, 'one', 0), manager.vote(board.id, scope, 'one', 1)]);
        expect((await manager.get(board.id))?.votes).toEqual(new Map([['one', [1]]]));
        const results = await Promise.allSettled([
            manager.close(board.id, scope, 'creator'), manager.vote(board.id, scope, 'one', 0),
        ]);
        expect(results[0]?.status).toBe('fulfilled');
        expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'closed' } });
        expect((await manager.get(board.id))?.votes).toEqual(new Map([['one', [1]]]));
    });

    it('requires the exact guild, channel and message before voting or moderator closing', async () => {
        const manager = new PollManager();
        const board = await manager.create(input);
        for (const field of ['guildId', 'channelId', 'messageId'] as const) {
            const forged = { ...scope, [field]: 'other' };
            await expect(manager.vote(board.id, forged, 'one', 0)).rejects.toMatchObject({ code: 'missing' });
            await expect(manager.close(board.id, forged, 'moderator', true)).rejects.toMatchObject({ code: 'missing' });
            expect(await manager.get(board.id, forged)).toBeNull();
        }
        await expect(manager.close(board.id, scope, 'one')).rejects.toMatchObject({ code: 'not-authorized' });
        expect((await manager.close(board.id, scope, 'moderator', true)).closeReason).toBe('moderator');
    });

    it('expires overdue polls at their persisted deadline during startup recovery', async () => {
        let now = 1_000;
        const manager = new PollManager({ now: () => now });
        const board = await manager.create(input);
        await manager.vote(board.id, scope, 'one', 0);
        now = 100_000;
        const recovered = await new PollManager({ now: () => now }).listForRecovery();
        expect(recovered[0]).toMatchObject({ closeReason: 'expired', closedAt: 61_000, renderPending: true });
        await expect(manager.vote(board.id, scope, 'two', 1)).rejects.toMatchObject({ code: 'closed' });
        await manager.markRendered(board.id, recovered[0]?.version ?? -1);
        expect(await manager.listForRecovery()).toEqual([]);
    });

    it('retains a newer pending render when an older in-flight edit completes', async () => {
        const manager = new PollManager();
        const board = await manager.create(input);
        await manager.vote(board.id, scope, 'one', 0);
        await manager.markRendered(board.id, board.version);
        expect((await manager.get(board.id))?.renderPending).toBe(true);
        const closed = await manager.close(board.id, scope, 'creator');
        await manager.markRendered(board.id, closed.version);
        expect((await manager.get(board.id))?.renderPending).toBe(false);
    });

    it('keeps finished polls for 90 days with a separate cap for each guild', async () => {
        let now = 1_000;
        const manager = new PollManager({ now: () => now, maxFinished: 2 });
        const foreign = await manager.create({ ...input, guildId: 'foreign' });
        await manager.close(foreign.id, { ...scope, guildId: 'foreign' }, 'creator');
        const ids: string[] = [];
        for (let i = 0; i < 3; i++) {
            now += 1;
            const board = await manager.create({ ...input, messageId: `message-${i}` });
            ids.push(board.id);
            await manager.close(board.id, { ...scope, messageId: `message-${i}` }, 'creator');
        }
        await manager.listForRecovery();
        expect(await manager.get(ids[0] ?? '')).toBeNull();
        expect(await manager.get(foreign.id)).not.toBeNull();
        expect(await manager.get(ids[1] ?? '')).not.toBeNull();
        now += POLL_RETENTION_MS + 1;
        await manager.listForRecovery();
        expect(await PollSession.count()).toBe(0);
    });

    it('preserves votes on failed writes and permits recovery on the next action', async () => {
        const manager = new PollManager();
        const board = await manager.create(input);
        await manager.vote(board.id, scope, 'one', 0);
        const update = vi.spyOn(PollSession.prototype, 'update').mockRejectedValueOnce(new Error('database unavailable'));
        await expect(manager.vote(board.id, scope, 'one', 1)).rejects.toThrow('database unavailable');
        update.mockRestore();
        expect((await new PollManager().get(board.id))?.votes.get('one')).toEqual([0]);
        expect((await manager.vote(board.id, scope, 'one', 1)).votes.get('one')).toEqual([1]);
    });

    it('rejects invalid input, stale IDs, invalid indices and capacity overflow', async () => {
        const manager = new PollManager({ maxActive: 1 });
        for (const invalid of [
            { ...input, question: ' ' }, { ...input, options: ['Alpha', 'ＡＬＰＨＡ'] },
            { ...input, durationMinutes: 0 }, { ...input, durationMinutes: 1.5 }, { ...input, messageId: '' },
        ]) await expect(manager.create(invalid)).rejects.toMatchObject({ code: 'invalid-input' });
        const board = await manager.create(input);
        await expect(manager.create({ ...input, messageId: 'second' })).rejects.toMatchObject({ code: 'capacity' });
        await expect(manager.vote(board.id, scope, 'one', 2)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.vote('old-memory-poll', scope, 'one', 0)).rejects.toMatchObject({ code: 'missing' });
    });
});
