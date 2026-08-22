import { beforeEach, describe, expect, it } from 'vitest';
import { GameNightNomination } from '../../models/game-night-nomination.js';
import { GameNightSession } from '../../models/game-night-session.js';
import { GameNightVote } from '../../models/game-night-vote.js';
import {
    GameNightManager,
    normalizeGameNightKey,
    normalizeGameNightName,
} from '../gameNightManager.js';

function manager(options: { now?: () => number; pickTieIndex?: (count: number) => number } = {}): GameNightManager {
    let nextId = 0;
    return new GameNightManager({
        createId: () => `game-night-${++nextId}`,
        ...options,
    });
}

async function clearGameNights(): Promise<void> {
    await GameNightVote.destroy({ where: {} });
    await GameNightNomination.destroy({ where: {} });
    await GameNightSession.destroy({ where: {} });
}

async function createVotingBoard(gameNightManager: GameNightManager) {
    const board = await gameNightManager.start({
        guildId: 'guild-1',
        channelId: 'channel-1',
        creatorId: 'host',
        name: 'Friday',
    });
    await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Alpha' });
    await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'two', gameName: 'Beta' });
    return gameNightManager.openVoting(board.session.id, 'host');
}

beforeEach(clearGameNights);

describe('GameNightManager', () => {
    it('normalizes names and rejects case-insensitive duplicates', async () => {
        const gameNightManager = manager();
        expect(normalizeGameNightName('  Deep   Rock  ')).toBe('Deep Rock');
        expect(normalizeGameNightKey('ＤＥＥＰ Rock')).toBe('deep rock');
        expect(normalizeGameNightName('\u200B')).toBe('');
        expect(normalizeGameNightName('Pokémon 🎮')).toBe('Pokémon 🎮');
        expect(normalizeGameNightName('Deep\nRock')).toBe('Deep Rock');
        expect(normalizeGameNightName('Co-op 👩‍💻')).toBe('Co-op 👩‍💻');

        await gameNightManager.start({ guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: ' Friday ' });
        await expect(gameNightManager.nominate({
            guildId: 'guild-1', channelId: 'channel-1', userId: 'invisible', gameName: '\u200B',
        })).rejects.toMatchObject({ code: 'invalid-name' });
        await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: ' Deep Rock ' });
        await expect(gameNightManager.nominate({
            guildId: 'guild-1',
            channelId: 'channel-1',
            userId: 'two',
            gameName: 'ＤＥＥＰ   ROCK',
        })).rejects.toMatchObject({ code: 'duplicate-nomination' });
    });

    it('isolates active sessions by guild and enforces their channel', async () => {
        const gameNightManager = manager();
        await gameNightManager.start({ guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'One' });
        await gameNightManager.start({ guildId: 'guild-2', channelId: 'channel-2', creatorId: 'host', name: 'Two' });
        await expect(gameNightManager.start({
            guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'Duplicate',
        })).rejects.toMatchObject({ code: 'active-session-exists' });
        await expect(gameNightManager.nominate({
            guildId: 'guild-1', channelId: 'channel-2', userId: 'one', gameName: 'Alpha',
        })).rejects.toMatchObject({ code: 'wrong-channel' });
    });

    it('enforces creator-owned transitions and one nomination per member', async () => {
        const gameNightManager = manager();
        const board = await gameNightManager.start({ guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'Friday' });
        await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Alpha' });
        await expect(gameNightManager.nominate({
            guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Beta',
        })).rejects.toMatchObject({ code: 'own-nomination-exists' });
        await expect(gameNightManager.openVoting(board.session.id, 'intruder'))
            .rejects.toMatchObject({ code: 'not-creator' });
        await expect(gameNightManager.openVoting(board.session.id, 'host'))
            .rejects.toMatchObject({ code: 'too-few-nominations' });
    });

    it('allows multiple nominations for moderators or when enabled for everyone', async () => {
        const gameNightManager = manager();
        await gameNightManager.start({
            guildId: 'guild-1',
            channelId: 'channel-1',
            creatorId: 'host',
            name: 'Movies',
            kind: 'movie',
            allowMultipleNominations: true,
        });
        await gameNightManager.nominate({
            guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Alien',
        });
        const multiple = await gameNightManager.nominate({
            guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Arrival',
        });
        expect(multiple.session).toMatchObject({ kind: 'movie', allowMultipleNominations: true });
        expect(multiple.nominations.filter(item => item.userId === 'one')).toHaveLength(2);

        await gameNightManager.start({
            guildId: 'guild-2', channelId: 'channel-2', creatorId: 'host', name: 'Games',
        });
        await gameNightManager.nominate({
            guildId: 'guild-2', channelId: 'channel-2', userId: 'moderator', gameName: 'Alpha',
        });
        await expect(gameNightManager.nominate({
            guildId: 'guild-2',
            channelId: 'channel-2',
            userId: 'moderator',
            gameName: 'Beta',
            canManageNominations: true,
        })).resolves.toMatchObject({ nominations: expect.arrayContaining([
            expect.objectContaining({ gameName: 'Alpha' }),
            expect.objectContaining({ gameName: 'Beta' }),
        ]) });
    });

    it('allows moderators to open and close voting', async () => {
        const gameNightManager = manager({ pickTieIndex: () => 0 });
        const board = await gameNightManager.start({
            guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'Friday',
        });
        await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Alpha' });
        await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'two', gameName: 'Beta' });
        const voting = await gameNightManager.openVoting(board.session.id, 'moderator', true);
        await expect(gameNightManager.close(voting.session.id, 'moderator', true))
            .resolves.toMatchObject({ session: { state: 'finished' } });
    });

    it('persists one changeable vote per member', async () => {
        const gameNightManager = manager();
        const board = await createVotingBoard(gameNightManager);
        const [alpha, beta] = board.nominations;
        if (!alpha || !beta) throw new Error('Expected finalists.');
        await gameNightManager.vote(board.session.id, 'voter', alpha.id);
        const changed = await gameNightManager.vote(board.session.id, 'voter', beta.id);
        expect(changed.nominations).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: alpha.id, voteCount: 0 }),
            expect.objectContaining({ id: beta.id, voteCount: 1 }),
        ]));
        expect(await GameNightVote.count({ where: { sessionId: board.session.id, userId: 'voter' } })).toBe(1);
    });

    it('records deterministic tiebreak evidence and survives a new manager instance', async () => {
        const gameNightManager = manager({ pickTieIndex: () => 1 });
        const board = await createVotingBoard(gameNightManager);
        const closed = await gameNightManager.close(board.session.id, 'host');
        expect(closed.session.state).toBe('finished');
        expect(closed.session.tieBreakCandidateIds).toEqual(board.nominations.map(item => item.id));
        expect(closed.session.tieBreakIndex).toBe(1);
        expect(closed.session.winnerNominationId).toBe(board.nominations[1]?.id);
        expect((await manager().getById(board.session.id))?.session).toMatchObject({
            state: 'finished',
            winnerNominationId: board.nominations[1]?.id,
            tieBreakIndex: 1,
        });
    });

    it('serializes concurrent nominations and finalization', async () => {
        const gameNightManager = manager({ pickTieIndex: () => 0 });
        await gameNightManager.start({ guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'Friday' });
        const nominations = await Promise.allSettled([
            gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'one', gameName: 'Alpha' }),
            gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'two', gameName: 'alpha' }),
        ]);
        expect(nominations.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        await gameNightManager.nominate({ guildId: 'guild-1', channelId: 'channel-1', userId: 'three', gameName: 'Beta' });
        const active = await gameNightManager.getActive('guild-1');
        if (!active) throw new Error('Expected an active board.');
        await gameNightManager.openVoting(active.session.id, 'host');
        const closes = await Promise.allSettled([
            gameNightManager.close(active.session.id, 'host'),
            gameNightManager.close(active.session.id, 'host'),
        ]);
        expect(closes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(await GameNightSession.count({ where: { id: active.session.id, state: 'finished' } })).toBe(1);
    });

    it('expires unfinished boards and releases the guild active slot', async () => {
        let now = 1_000;
        const gameNightManager = manager({ now: () => now });
        const board = await gameNightManager.start({
            guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'Friday', durationHours: 1,
        });
        now += 60 * 60 * 1_000;
        expect((await gameNightManager.getById(board.session.id))?.session.state).toBe('expired');
        await expect(gameNightManager.vote(board.session.id, 'voter', 'missing'))
            .rejects.toMatchObject({ code: 'expired' });
        await expect(gameNightManager.start({
            guildId: 'guild-1', channelId: 'channel-1', creatorId: 'host', name: 'Next',
        })).resolves.toMatchObject({ session: { state: 'nominating' } });
    });
});
