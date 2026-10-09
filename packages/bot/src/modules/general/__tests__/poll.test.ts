import type { ButtonInteraction, ChatInputCommandInteraction, Client } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfigManager, PollError, type PollBoard, type PollManager } from '@zeffuro/fakegaming-common/managers';
import pollCommand, { createPollComponentHandler, hasDuplicatePollOptions, normalizePollQuestion } from '../commands/poll.js';
import { renderPollMessage } from '../shared/pollSession.js';
import { PollRuntime, type PollPersistence } from '../shared/pollRuntime.js';
import * as runtimeModule from '../shared/pollRuntime.js';
import { getGeneralCopy } from '../data/generalCopy.js';

function board(overrides: Partial<PollBoard> = {}): PollBoard {
    return {
        id: 'poll-1', guildId: 'guild', channelId: 'channel', messageId: 'message', creatorId: 'creator',
        question: 'Which option?', options: ['Alpha', 'Beta'], votes: new Map(), allowMultiple: false,
        expiresAt: Date.now() + 60_000, closedAt: null, closeReason: null, locale: 'en', version: 0, renderPending: true,
        ...overrides,
    };
}

function persistence(initial = board()) {
    let current = initial;
    const manager = {
        create: vi.fn(async () => current),
        get: vi.fn(async () => current),
        vote: vi.fn(async () => current),
        close: vi.fn(async () => current),
        listForRecovery: vi.fn(async () => [current]),
        markRendered: vi.fn(async (_id: string, version: number) => {
            if (current.version === version) current = { ...current, renderPending: false };
        }),
    } satisfies PollPersistence;
    return { manager, set: (next: PollBoard) => { current = next; } };
}

function button(customId: string, userId = 'voter', canManage = false) {
    const value = {
        customId, guildId: 'guild' as string | null, channelId: 'channel', message: { id: 'message' }, user: { id: userId },
        memberPermissions: { has: vi.fn(() => canManage) },
        deferUpdate: vi.fn().mockResolvedValue(undefined), followUp: vi.fn().mockResolvedValue(undefined),
    };
    return value as typeof value & ButtonInteraction;
}

function slash(values: Record<string, string> = { question: 'Which?', option1: 'Alpha', option2: 'Beta' }, duration: number | null = null) {
    return {
        guildId: 'guild' as string | null, channelId: 'channel', locale: 'en-US', user: { id: 'creator' },
        deferReply: vi.fn().mockResolvedValue(undefined), fetchReply: vi.fn().mockResolvedValue({ id: 'message' }),
        reply: vi.fn().mockResolvedValue(undefined), editReply: vi.fn().mockResolvedValue(undefined),
        options: {
            getString: vi.fn((name: string) => values[name] ?? null),
            getInteger: vi.fn(() => duration), getBoolean: vi.fn(() => true),
        },
    };
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    runtimeModule.stopPollRuntime();
});

describe('persistent poll components and presentation', () => {
    it('renders single and multiple counts as the percentage of voters, with locale IDs and final ties', () => {
        const session = board({ allowMultiple: true, locale: 'nl', votes: new Map([['one', [0, 1]], ['two', [1]]]) });
        const rendered = renderPollMessage(session);
        expect(rendered.content).toContain('50%');
        expect(rendered.content).toContain('100%');
        expect(rendered.content).toContain(getGeneralCopy('nl').poll.multipleVoting);
        expect(rendered.content).toContain(getGeneralCopy('nl').poll.total(2));
        expect(rendered.allowedMentions).toEqual({ parse: [] });
        expect(rendered.components[0]?.components[0]?.toJSON()).toMatchObject({ custom_id: 'poll:vote:poll-1:0:nl' });
        const tied = renderPollMessage(board({ votes: new Map([['one', [0]], ['two', [1]]]), closedAt: 1, closeReason: 'moderator' }));
        expect(tied.content).toContain('Result: tie between **Alpha**, **Beta**');
        expect(tied.content).toContain(getGeneralCopy('en').poll.closedByModerator);
        expect(tied.components.flatMap(row => row.components).every(component => component.data.disabled)).toBe(true);
    });

    it('bounds five long options and a tied final result in both locales', () => {
        for (const locale of ['en', 'nl'] as const) {
            const long = board({
                locale, question: 'Q'.repeat(200), options: Array.from({ length: 5 }, (_, i) => `${i}${'O'.repeat(199)}`),
                votes: new Map([['one', [0, 1, 2, 3, 4]]]), allowMultiple: true, closedAt: 1, closeReason: 'expired',
            });
            const rendered = renderPollMessage(long);
            expect(rendered.content.length).toBeLessThanOrEqual(2_000);
            expect(rendered.components[0]?.components).toHaveLength(5);
            expect(rendered.components[1]?.components).toHaveLength(1);
        }
        const metadata = pollCommand.data.toJSON();
        expect(metadata.options?.find(option => option.name === 'multiple')).toMatchObject({ type: 5 });
        expect(metadata.dm_permission).not.toBe(false);
        expect(metadata.options?.find(option => option.name === 'question')).toMatchObject({ max_length: 200 });
    });

    it('normalizes questions and duplicate option labels', () => {
        expect(normalizePollQuestion('  Which?  ')).toBe('Which?');
        expect(normalizePollQuestion(' ')).toBe('');
        expect(hasDuplicatePollOptions([' Alpha ', 'ＡＬＰＨＡ'])).toBe(true);
    });

    it('renders no-vote results and a single winner without arbitrary tie breaks', () => {
        const closed = board({ closedAt: 1, closeReason: 'creator' });
        expect(renderPollMessage(closed).content).toContain(getGeneralCopy('en').poll.noVotes);
        const won = renderPollMessage({ ...closed, votes: new Map([['one', [1]]]) });
        expect(won.content).toContain(getGeneralCopy('en').poll.winner('Beta', 1));
        expect(won.content).toContain(getGeneralCopy('en').poll.singleVoting);
    });

    it('defers before storage, passes full scope and acknowledges multiple selections privately', async () => {
        const { manager } = persistence(board({ allowMultiple: true, votes: new Map([['voter', [0, 1]]]) }));
        const runtime = new PollRuntime(manager, vi.fn());
        const interaction = button('poll:vote:poll-1:0:nl');
        manager.vote.mockImplementation(async () => {
            expect(interaction.deferUpdate).toHaveBeenCalledOnce();
            return board({ allowMultiple: true, votes: new Map([['voter', [0, 1]]]) });
        });
        await expect(createPollComponentHandler(runtime)(interaction)).resolves.toBe(true);
        expect(manager.vote).toHaveBeenCalledWith('poll-1', { guildId: 'guild', channelId: 'channel', messageId: 'message' }, 'voter', 0);
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: getGeneralCopy('nl').poll.selected(2) }));
        runtime.stop();
    });

    it('passes moderator capability and returns localized closed, permission and persistence errors', async () => {
        const { manager } = persistence();
        const runtime = new PollRuntime(manager, vi.fn());
        const handler = createPollComponentHandler(runtime);
        const moderator = button('poll:close:poll-1:nl', 'moderator', true);
        await handler(moderator);
        expect(manager.close).toHaveBeenCalledWith('poll-1', expect.anything(), 'moderator', true);
        for (const [error, expected] of [
            [new PollError('closed'), getGeneralCopy('nl').poll.closed],
            [new PollError('not-authorized'), getGeneralCopy('nl').poll.creatorOrModerator],
            [new Error('db unavailable'), getGeneralCopy('nl').poll.failure],
        ] as const) {
            manager.close.mockRejectedValueOnce(error);
            const interaction = button('poll:close:poll-1:nl');
            await handler(interaction);
            expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expected }));
        }
        runtime.stop();
    });

    it('rejects stale, malformed and unscoped IDs while preserving namespace routing', async () => {
        const { manager } = persistence();
        const runtime = new PollRuntime(manager, vi.fn());
        const handler = createPollComponentHandler(runtime);
        manager.vote.mockRejectedValueOnce(new PollError('missing'));
        for (const customId of ['poll:vote:missing:0:nl', 'poll:vote:poll-1::nl', 'poll:vote:poll-1:0:extra:nl']) {
            const interaction = button(customId);
            expect(await handler(interaction)).toBe(true);
            expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: getGeneralCopy('nl').poll.unavailable }));
        }
        expect(await handler(button('anime:subscribe:42'))).toBe(false);
        runtime.stop();
    });

    it('defers poll creation before storage and persists the reply binding and multiple setting', async () => {
        const { manager } = persistence();
        const runtime = new PollRuntime(manager, vi.fn());
        vi.spyOn(runtimeModule, 'getPollRuntime').mockReturnValue(runtime);
        const value = slash();
        manager.create.mockImplementation(async () => {
            expect(value.deferReply).toHaveBeenCalledOnce();
            return board();
        });
        await pollCommand.execute(value as unknown as ChatInputCommandInteraction);
        expect(manager.create).toHaveBeenCalledWith(expect.objectContaining({
            guildId: 'guild', channelId: 'channel', messageId: 'message', allowMultiple: true, durationMinutes: 10,
        }));
        runtime.stop();
    });

    it('validates creation before allocating storage and explains capacity or save failures', async () => {
        const { manager } = persistence();
        const runtime = new PollRuntime(manager, vi.fn());
        vi.spyOn(runtimeModule, 'getPollRuntime').mockReturnValue(runtime);
        const copy = getGeneralCopy('en').poll;
        const cases = [
            [slash({ question: ' ', option1: 'Alpha', option2: 'Beta' }), copy.questionRequired],
            [slash({ question: 'Which?', option1: 'Alpha', option2: ' ' }), copy.twoOptions],
            [slash({ question: 'Which?', option1: 'Alpha', option2: 'alpha' }), copy.unique],
            [slash(undefined, 0), copy.duration(1, 1440)],
        ] as const;
        for (const [interaction, content] of cases) {
            await pollCommand.execute(interaction as unknown as ChatInputCommandInteraction);
            expect(interaction.editReply).toHaveBeenCalledWith(content);
        }
        expect(manager.create).not.toHaveBeenCalled();
        for (const [error, content] of [[new PollError('capacity'), copy.capacity], [new Error('DB unavailable'), copy.failure]] as const) {
            manager.create.mockRejectedValueOnce(error);
            const interaction = slash();
            await pollCommand.execute(interaction as unknown as ChatInputCommandInteraction);
            expect(interaction.editReply).toHaveBeenCalledWith(content);
        }
        runtime.stop();
    });

    it('creates and votes in a durable DM poll under the recipient scope', async () => {
        const dmBoard = board({ guildId: 'dm:creator' });
        const { manager } = persistence(dmBoard);
        const runtime = new PollRuntime(manager, vi.fn());
        vi.spyOn(runtimeModule, 'getPollRuntime').mockReturnValue(runtime);
        const interaction = slash();
        interaction.guildId = null;
        await pollCommand.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.deferReply).toHaveBeenCalledOnce();
        expect(manager.create).toHaveBeenCalledWith(expect.objectContaining({
            guildId: 'dm:creator', channelId: 'channel', messageId: 'message', creatorId: 'creator',
        }));
        const vote = button('poll:vote:poll-1:0:nl', 'creator');
        vote.guildId = null;
        const handler = createPollComponentHandler(runtime);
        await handler(vote);
        expect(manager.vote).toHaveBeenCalledWith('poll-1', { guildId: 'dm:creator', channelId: 'channel', messageId: 'message' }, 'creator', 0);
        const intruder = button('poll:vote:poll-1:0:nl', 'intruder');
        intruder.guildId = null;
        manager.vote.mockRejectedValueOnce(new PollError('missing'));
        await handler(intruder);
        expect(manager.vote).toHaveBeenLastCalledWith('poll-1', { guildId: 'dm:intruder', channelId: 'channel', messageId: 'message' }, 'intruder', 0);
        expect(intruder.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: getGeneralCopy('nl').poll.unavailable }));
        runtime.stop();
    });
});

describe('poll runtime recovery and rendering', () => {
    it('restores a DM only for its persisted recipient and refuses mismatched recipients', async () => {
        const config = getConfigManager();
        const previous = config.pollManager;
        const dmBoard = board({ guildId: 'dm:creator' });
        const state = persistence(dmBoard);
        config.pollManager = state.manager as unknown as PollManager;
        const edit = vi.fn().mockResolvedValue(undefined);
        const channel = { isTextBased: () => true, isDMBased: () => true, recipientId: 'creator', messages: { edit } };
        const fetch = vi.fn().mockResolvedValue(channel);
        try {
            await runtimeModule.initializePollRuntime({ channels: { fetch } } as unknown as Client);
            await runtimeModule.getPollRuntime().refresh('poll-1');
            expect(edit).toHaveBeenCalledWith('message', expect.objectContaining({ content: expect.stringContaining('Which option?') }));
            state.set({ ...dmBoard, version: 1 });
            channel.recipientId = 'other-recipient';
            await expect(runtimeModule.getPollRuntime().refresh('poll-1')).rejects.toThrow('Poll channel is unavailable');
            expect(edit).toHaveBeenCalledOnce();
            channel.recipientId = 'creator';
            channel.isDMBased = () => false;
            await expect(runtimeModule.getPollRuntime().refresh('poll-1')).rejects.toThrow('Poll channel is unavailable');
            expect(edit).toHaveBeenCalledOnce();
        } finally {
            runtimeModule.stopPollRuntime();
            config.pollManager = previous;
        }
    });

    it('restores bound guild messages through the client and refuses a channel in another guild', async () => {
        const config = getConfigManager();
        const previous = config.pollManager;
        const state = persistence();
        config.pollManager = state.manager as unknown as PollManager;
        const edit = vi.fn().mockResolvedValue(undefined);
        const channel = { isTextBased: () => true, guildId: 'guild', messages: { edit } };
        const fetch = vi.fn().mockResolvedValue(channel);
        try {
            await runtimeModule.initializePollRuntime({ channels: { fetch } } as unknown as Client);
            await runtimeModule.getPollRuntime().refresh('poll-1');
            expect(fetch).toHaveBeenCalledWith('channel');
            expect(edit).toHaveBeenCalledWith('message', expect.objectContaining({ allowedMentions: { parse: [] } }));
            state.set(board({ version: 1 }));
            channel.guildId = 'other-guild';
            await expect(runtimeModule.getPollRuntime().refresh('poll-1')).rejects.toThrow('Poll channel is unavailable');
        } finally {
            runtimeModule.stopPollRuntime();
            config.pollManager = previous;
        }
        expect(() => runtimeModule.getPollRuntime()).toThrow('not been initialized');
    });

    it('retries startup recovery after temporary database failure', async () => {
        vi.useFakeTimers();
        const state = persistence();
        state.manager.listForRecovery.mockRejectedValueOnce(new Error('startup database unavailable'));
        const edit = vi.fn().mockResolvedValue(undefined);
        const runtime = new PollRuntime(state.manager, edit, { sweepMs: 1_000 });
        await expect(runtime.start()).rejects.toThrow('startup database unavailable');
        await vi.advanceTimersByTimeAsync(1_001);
        expect(edit).toHaveBeenCalledOnce();
        runtime.stop();
    });

    it('coalesces vote bursts and loads the newest counts at render time', async () => {
        vi.useFakeTimers();
        const state = persistence();
        const edit = vi.fn().mockResolvedValue(undefined);
        const runtime = new PollRuntime(state.manager, edit, { debounceMs: 25 });
        runtime.track(board());
        state.set(board({ version: 2, votes: new Map([['one', [0]], ['two', [1]]]) }));
        runtime.track(board({ version: 1 }));
        await vi.advanceTimersByTimeAsync(24);
        expect(edit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(edit).toHaveBeenCalledOnce();
        expect(edit.mock.calls[0]?.[0].votes.size).toBe(2);
        runtime.stop();
    });

    it('serializes an in-flight live render before the final result and preserves its pending version', async () => {
        const state = persistence();
        let resolveEdit: (() => void) | undefined;
        const edit = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { resolveEdit = resolve; })).mockResolvedValue(undefined);
        const runtime = new PollRuntime(state.manager, edit);
        const first = runtime.refresh('poll-1');
        await vi.waitFor(() => expect(resolveEdit).toBeDefined());
        const closed = board({ closedAt: 1, closeReason: 'creator', version: 1 });
        state.set(closed);
        const final = runtime.refresh('poll-1');
        resolveEdit?.();
        await Promise.all([first, final]);
        expect(edit).toHaveBeenCalledTimes(2);
        expect(edit.mock.calls[1]?.[0]).toMatchObject({ closedAt: 1, closeReason: 'creator' });
        runtime.stop();
    });

    it('restores expiry and retries a failed Discord edit from durable pending state', async () => {
        vi.useFakeTimers();
        const state = persistence();
        const edit = vi.fn().mockRejectedValueOnce(new Error('Discord down')).mockResolvedValue(undefined);
        const runtime = new PollRuntime(state.manager, edit, { sweepMs: 1_000 });
        await runtime.start();
        await vi.advanceTimersByTimeAsync(1);
        expect(edit).toHaveBeenCalledOnce();
        expect(state.manager.markRendered).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(edit).toHaveBeenCalledTimes(2);
        expect(state.manager.markRendered).toHaveBeenCalledWith('poll-1', 0);
        runtime.stop();
    });

    it('retries expiry storage failure on the next recovery scan', async () => {
        vi.useFakeTimers();
        const due = board({ expiresAt: Date.now() + 20, renderPending: false });
        const state = persistence(due);
        const edit = vi.fn().mockResolvedValue(undefined);
        const runtime = new PollRuntime(state.manager, edit, { sweepMs: 1_000 });
        state.manager.get.mockRejectedValueOnce(new Error('DB temporarily down'));
        await runtime.start();
        await vi.advanceTimersByTimeAsync(20);
        expect(edit).not.toHaveBeenCalled();
        state.set({ ...due, closedAt: due.expiresAt, closeReason: 'expired', renderPending: true, version: 1 });
        await vi.advanceTimersByTimeAsync(981);
        expect(edit).toHaveBeenCalledWith(expect.objectContaining({ closeReason: 'expired' }));
        runtime.stop();
    });
});
