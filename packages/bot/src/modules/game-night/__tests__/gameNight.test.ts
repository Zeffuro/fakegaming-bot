import type { ButtonInteraction, Client } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameNightError, type GameNightBoard, type GameNightManager } from '@zeffuro/fakegaming-common';
import gameNightCommand, { createGameNightHandlers, findNominationForUser } from '../commands/gameNight.js';
import { renderGameNightBoard } from '../shared/gameNightPresentation.js';
import { cancelGameNightRefresh, queueGameNightRefresh } from '../shared/gameNightRuntime.js';

afterEach(() => {
    cancelGameNightRefresh('session-1');
    vi.useRealTimers();
});

function board(state: GameNightBoard['session']['state'] = 'voting'): GameNightBoard {
    return {
        session: {
            id: 'session-1',
            guildId: 'guild-1',
            channelId: 'channel-1',
            messageId: 'message-1',
            creatorId: 'host',
            name: 'Friday **Night**',
            kind: 'game',
            allowMultipleNominations: false,
            state,
            expiresAt: 2_000_000_000_000,
            winnerNominationId: null,
            tieBreakCandidateIds: [],
            tieBreakIndex: null,
        },
        nominations: [
            { id: 'nomination-1', userId: 'one', gameName: 'Alpha @everyone', voteCount: 1 },
            { id: 'nomination-2', userId: 'two', gameName: 'Beta', voteCount: 2 },
        ],
    };
}

function manager(overrides: Partial<Record<keyof GameNightManager, unknown>>): GameNightManager {
    return overrides as unknown as GameNightManager;
}

function button(customId: string, userId = 'voter', canManage = false): ButtonInteraction & {
    reply: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deferUpdate: ReturnType<typeof vi.fn>;
} {
    return {
        customId,
        user: { id: userId },
        memberPermissions: { has: vi.fn(() => canManage) },
        replied: false,
        deferred: false,
        reply: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        client: {},
    } as unknown as ButtonInteraction & {
        reply: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        deferUpdate: ReturnType<typeof vi.fn>;
    };
}

describe('Game Night Board command', () => {
    it('publishes Dutch command, subcommand, and option metadata', () => {
        const json = gameNightCommand.data.toJSON();
        expect(json.name_localizations?.nl).toBe('avond');
        expect(json.description_localizations?.nl).toBeTruthy();
        for (const subcommand of json.options ?? []) {
            expect(subcommand.name_localizations?.nl).toBeTruthy();
            expect(subcommand.description_localizations?.nl).toBeTruthy();
            for (const option of 'options' in subcommand ? subcommand.options ?? [] : []) {
                expect(option.name_localizations?.nl).toBeTruthy();
                expect(option.description_localizations?.nl).toBeTruthy();
            }
        }
    });

    it('renders bounded voting controls with safe mentions and escaped user content', () => {
        const rendered = renderGameNightBoard(board());
        expect(rendered.allowedMentions).toEqual({ parse: [] });
        expect(rendered.content).toContain('Friday \\*\\*Night\\*\\*');
        expect(rendered.content).toContain('Alpha @everyone');
        expect(rendered.content).toContain('Nominations per member: one');
        expect(rendered.components).toHaveLength(2);
        expect(rendered.components[0]?.components).toHaveLength(2);
        expect(rendered.components[0]?.components[0]?.toJSON()).toMatchObject({
            custom_id: 'game-night:vote:session-1:nomination-1',
        });
        expect(rendered.content.length).toBeLessThanOrEqual(2_000);
    });

    it('renders Dutch board copy and locale-stable component IDs', () => {
        const rendered = renderGameNightBoard(board(), 'nl');
        expect(rendered.content).toContain('**Spelavond: Friday');
        expect(rendered.content).toContain('Status: de stemming is geopend');
        expect(rendered.content).toContain('2 stemmen');
        expect(rendered.components[0]?.components[0]?.toJSON()).toMatchObject({
            custom_id: 'game-night:vote:session-1:nomination-1:nl',
        });
        expect(rendered.components[1]?.components[0]?.toJSON()).toMatchObject({ label: 'Winnaar kiezen' });
    });

    it('renders movie nights and the multiple-nomination policy', () => {
        const movieNight = board('nominating');
        movieNight.session.kind = 'movie';
        movieNight.session.allowMultipleNominations = true;
        const rendered = renderGameNightBoard(movieNight);
        expect(rendered.content).toContain('**Movie Night: Friday');
        expect(rendered.content).toContain('Nominations per member: multiple');
    });

    it('renders the recorded winner and tiebreak evidence after closing', () => {
        const closed = board('finished');
        closed.session.winnerNominationId = 'nomination-2';
        closed.session.tieBreakCandidateIds = ['nomination-1', 'nomination-2'];
        closed.session.tieBreakIndex = 1;
        const rendered = renderGameNightBoard(closed);
        expect(rendered.content).toContain("Tonight's pick: **Beta**");
        expect(rendered.content).toContain('Tiebreak recorded between:');
        expect(rendered.components).toEqual([]);
    });

    it('records a component vote and refreshes the public board', async () => {
        const updated = board();
        const vote = vi.fn().mockResolvedValue(updated);
        const queueRefresh = vi.fn();
        const handlers = createGameNightHandlers(manager({ vote }), { queueRefresh });
        const interaction = button('game-night:vote:session-1:nomination-2');
        await expect(handlers.handleComponent(interaction)).resolves.toBe(true);
        expect(vote).toHaveBeenCalledWith('session-1', 'voter', 'nomination-2');
        expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(queueRefresh).toHaveBeenCalledWith(interaction.client, updated);
    });

    it('passes moderator authority to night controls', async () => {
        const finished = board('finished');
        const close = vi.fn().mockResolvedValue(finished);
        const handlers = createGameNightHandlers(manager({ close }));
        const moderator = button('game-night:close:session-1', 'moderator', true);

        await expect(handlers.handleComponent(moderator)).resolves.toBe(true);
        expect(close).toHaveBeenCalledWith('session-1', 'moderator', true);
        expect(moderator.update).toHaveBeenCalledTimes(1);
    });

    it('debounces vote bursts and renders the latest persisted counts', async () => {
        vi.useFakeTimers();
        const edit = vi.fn().mockResolvedValue(undefined);
        const client = {
            channels: {
                fetch: vi.fn().mockResolvedValue({
                    isTextBased: () => true,
                    messages: { edit },
                }),
            },
        } as unknown as Client;
        const first = board();
        const latest = board();
        latest.nominations[0]!.voteCount = 4;
        queueGameNightRefresh(client, first, 750);
        queueGameNightRefresh(client, latest, 750);
        await vi.advanceTimersByTimeAsync(749);
        expect(edit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(edit).toHaveBeenCalledTimes(1);
        expect(edit).toHaveBeenCalledWith('message-1', expect.objectContaining({
            content: expect.stringContaining('Alpha @everyone** - 4 votes'),
        }));
    });

    it('finds the caller nomination without relying on row ordering', () => {
        const current = board('nominating');
        current.nominations.push({ id: 'nomination-3', userId: 'one', gameName: 'Gamma', voteCount: 0 });
        current.nominations.reverse();
        expect(findNominationForUser(current, 'one', '  GAMMA  ')?.gameName).toBe('Gamma');
    });

    it('enforces creator errors and handles stale component IDs ephemerally', async () => {
        const close = vi.fn().mockRejectedValue(new GameNightError('not-creator'));
        const handlers = createGameNightHandlers(manager({ close }));
        const intruder = button('game-night:close:session-1', 'intruder');
        await handlers.handleComponent(intruder);
        expect(intruder.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Only the host or a moderator can do that.',
            flags: expect.any(Number),
        }));

        const malformed = button('game-night:vote:session-1');
        await handlers.handleComponent(malformed);
        expect(malformed.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('no longer available'),
        }));
        await expect(handlers.handleComponent(button('poll:vote:session-1:0'))).resolves.toBe(false);
    });

    it('registers server-only bounded slash inputs', () => {
        const json = gameNightCommand.data.toJSON();
        expect(json.name).toBe('night');
        expect(json.dm_permission).toBe(false);
        const options = json.options as Array<{
            name: string;
            options?: Array<{ name: string; max_length?: number; min_value?: number; max_value?: number }>;
        }>;
        const start = options.find(option => option.name === 'start');
        const nominate = options.find(option => option.name === 'nominate');
        expect(start?.options?.find(option => option.name === 'name')).toMatchObject({ max_length: 80 });
        expect(start?.options?.find(option => option.name === 'type')).toMatchObject({ required: true });
        expect(start?.options?.find(option => option.name === 'duration')).toMatchObject({ min_value: 1, max_value: 24 });
        expect(start?.options?.find(option => option.name === 'allow-multiple')).toMatchObject({ type: expect.any(Number) });
        expect(nominate?.options?.find(option => option.name === 'choice')).toMatchObject({ max_length: 80 });
    });
});
