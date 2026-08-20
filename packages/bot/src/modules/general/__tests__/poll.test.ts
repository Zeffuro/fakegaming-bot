import type { ButtonInteraction } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pollCommand, {
    createPollComponentHandler,
    hasDuplicatePollOptions,
    normalizePollQuestion,
} from '../commands/poll.js';
import {
    PollSessionStore,
    renderPollMessage,
    type PollSession,
    type PollSessionMessage,
} from '../shared/pollSession.js';

function createMessage(): PollSessionMessage & { edit: ReturnType<typeof vi.fn> } {
    return { edit: vi.fn().mockResolvedValue(undefined) };
}

function createStore(): PollSessionStore {
    return new PollSessionStore({
        createId: () => 'poll-1',
        renderDebounceMs: 25,
        sessionRetentionMs: 1_000,
    });
}

function createSession(store: PollSessionStore, message = createMessage()): PollSession {
    const session = store.create({
        creatorId: 'creator',
        question: 'Which option?',
        options: ['Alpha', 'Beta'],
        durationMinutes: 1,
        message,
    });
    if (!session) throw new Error('Expected poll session to be created.');
    return session;
}

function button(customId: string, userId = 'voter'): ButtonInteraction & {
    deferUpdate: ReturnType<typeof vi.fn>;
    reply: ReturnType<typeof vi.fn>;
} {
    return {
        customId,
        user: { id: userId },
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
    } as unknown as ButtonInteraction & {
        deferUpdate: ReturnType<typeof vi.fn>;
        reply: ReturnType<typeof vi.fn>;
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('PollSessionStore', () => {
    it('renders live counts and safe button component IDs', () => {
        const store = createStore();
        const session = createSession(store);
        store.vote(session.id, 'one', 0);
        store.vote(session.id, 'two', 1);
        store.vote(session.id, 'three', 1);

        const rendered = renderPollMessage(session);
        expect(rendered.content).toContain('1. Alpha - 1 vote (33%)');
        expect(rendered.content).toContain('2. Beta - 2 votes (67%)');
        expect(rendered.allowedMentions).toEqual({ parse: [] });
        expect(rendered.components[0]?.components).toHaveLength(2);
        expect(rendered.components[1]?.components).toHaveLength(1);
        expect(rendered.components[0]?.components[0]?.toJSON()).toMatchObject({ custom_id: 'poll:vote:poll-1:0' });
        expect(rendered.components[1]?.components[0]?.toJSON()).toMatchObject({ custom_id: 'poll:close:poll-1' });
        store.clear();
    });

    it('renders Dutch poll state and carries locale in new component IDs', () => {
        const store = createStore();
        const session = store.create({
            creatorId: 'creator',
            question: 'Welke optie?',
            options: ['Alfa', 'Bèta'],
            durationMinutes: 1,
            message: createMessage(),
            locale: 'nl',
        });
        if (!session) throw new Error('Expected poll session to be created.');
        store.vote(session.id, 'one', 0);

        const rendered = renderPollMessage(session);
        expect(rendered.content).toContain('1 stem');
        expect(rendered.content).toContain('Totaal aantal stemmen: 1');
        expect(rendered.components[0]?.components[0]?.toJSON()).toMatchObject({ custom_id: 'poll:vote:poll-1:0:nl' });
        expect(rendered.components[1]?.components[0]?.toJSON()).toMatchObject({ label: 'Peiling sluiten' });
        store.clear();
    });

    it('keeps one vote per user while allowing vote changes', () => {
        const store = createStore();
        const session = createSession(store);

        expect(store.vote(session.id, 'voter', 0)).toMatchObject({ status: 'recorded' });
        expect(store.vote(session.id, 'voter', 1)).toMatchObject({ status: 'recorded' });
        expect(store.vote(session.id, 'voter', 1)).toMatchObject({ status: 'unchanged' });

        const rendered = renderPollMessage(session);
        expect(session.votes.size).toBe(1);
        expect(rendered.content).toContain('1. Alpha - 0 votes (0%)');
        expect(rendered.content).toContain('2. Beta - 1 vote (100%)');
        store.clear();
    });

    it('rejects duplicate option labels after trim and case normalization', () => {
        expect(hasDuplicatePollOptions([' Alpha ', 'alpha'])).toBe(true);
        expect(hasDuplicatePollOptions(['Alpha', 'Beta'])).toBe(false);
    });

    it('trims poll questions and rejects whitespace-only input', () => {
        expect(normalizePollQuestion('  Which option?  ')).toBe('Which option?');
        expect(normalizePollQuestion('   ')).toBe('');
    });

    it('debounces public message updates during vote bursts', async () => {
        vi.useFakeTimers();
        const store = createStore();
        const message = createMessage();
        const session = createSession(store, message);

        store.vote(session.id, 'one', 0);
        store.vote(session.id, 'two', 1);
        await vi.advanceTimersByTimeAsync(24);
        expect(message.edit).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(message.edit).toHaveBeenCalledTimes(1);
        store.clear();
    });

    it('only allows the creator to close and renders final results', async () => {
        const store = createStore();
        const message = createMessage();
        const session = createSession(store, message);
        const handleComponent = createPollComponentHandler(store);

        const intruder = button(`poll:close:${session.id}`, 'intruder');
        await expect(handleComponent(intruder)).resolves.toBe(true);
        expect(intruder.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Only the poll creator can close this poll.',
        }));
        expect(session.closedAt).toBeNull();

        store.vote(session.id, 'one', 0);
        const creator = button(`poll:close:${session.id}`, 'creator');
        await expect(handleComponent(creator)).resolves.toBe(true);
        expect(creator.deferUpdate).toHaveBeenCalledTimes(1);
        expect(session.closedAt).not.toBeNull();
        expect(message.edit).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('Winner: **Alpha** (1 vote).'),
        }));
        store.clear();
    });

    it('reports ties and percentages in the final result', () => {
        const store = createStore();
        const session = createSession(store);
        store.vote(session.id, 'one', 0);
        store.vote(session.id, 'two', 1);
        store.close(session.id, 'creator');

        const rendered = renderPollMessage(session);
        expect(rendered.content).toContain('1. Alpha - 1 vote (50%)');
        expect(rendered.content).toContain('2. Beta - 1 vote (50%)');
        expect(rendered.content).toContain('Result: tie between **Alpha**, **Beta** (1 vote each).');
        expect(rendered.components.flatMap(row => row.components).every(component => component.data.disabled)).toBe(true);
        store.clear();
    });

    it('keeps five option buttons within Discord row limits and renders bounded slash input', () => {
        const store = createStore();
        const rendered = renderPollMessage({
            ...createSession(store),
            question: 'Q'.repeat(200),
            options: Array.from({ length: 5 }, () => 'O'.repeat(200)),
        });
        const commandJson = pollCommand.data.toJSON();
        const question = commandJson.options?.find(option => option.name === 'question');
        const options = commandJson.options?.filter(option => option.name.startsWith('option')) ?? [];

        expect(rendered.content.length).toBeLessThanOrEqual(2_000);
        expect(rendered.components).toHaveLength(2);
        expect(rendered.components[0]?.components).toHaveLength(5);
        expect(rendered.components[1]?.components).toHaveLength(1);
        expect(question).toMatchObject({ max_length: 200 });
        expect(options).toHaveLength(5);
        expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ max_length: 200 })]));
        store.clear();
    });

    it('expires polls, disables buttons, and rejects later clicks', async () => {
        vi.useFakeTimers();
        const store = createStore();
        const message = createMessage();
        const session = createSession(store, message);
        const handleComponent = createPollComponentHandler(store);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(session.closeReason).toBe('expired');
        expect(message.edit).toHaveBeenCalledWith(expect.objectContaining({
            components: expect.any(Array),
        }));

        const afterExpiry = button(`poll:vote:${session.id}:0`);
        await expect(handleComponent(afterExpiry)).resolves.toBe(true);
        expect(afterExpiry.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'This poll is closed.' }));
        store.clear();
    });

    it('handles concurrent double clicks without counting a user twice', async () => {
        const store = createStore();
        const session = createSession(store);
        const handleComponent = createPollComponentHandler(store);
        const first = button(`poll:vote:${session.id}:0`, 'voter');
        const second = button(`poll:vote:${session.id}:1`, 'voter');

        await Promise.all([handleComponent(first), handleComponent(second)]);
        expect(session.votes.size).toBe(1);
        expect([...session.votes.values()]).toHaveLength(1);
        expect(first.deferUpdate).toHaveBeenCalledTimes(1);
        expect(second.deferUpdate).toHaveBeenCalledTimes(1);
        store.clear();
    });

    it('handles stale and malformed poll component IDs without claiming another namespace', async () => {
        const store = createStore();
        const handleComponent = createPollComponentHandler(store);
        const stale = button('poll:vote:missing:0');
        const foreign = button('anime:subscribe:42');

        await expect(handleComponent(stale)).resolves.toBe(true);
        expect(stale.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('no longer available'),
        }));
        await expect(handleComponent(foreign)).resolves.toBe(false);
        const malformed = button('poll:vote:missing:');
        await expect(handleComponent(malformed)).resolves.toBe(true);
        expect(malformed.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('no longer available'),
        }));
        store.clear();
    });
});
