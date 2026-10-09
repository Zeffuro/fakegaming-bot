import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { PersonalError, type UserTaskBoard, type UserSessionBoard, type UserCountdownBoard } from '@zeffuro/fakegaming-common/managers';
import tasks, { renderTask } from '../commands/tasks.js';
import session, { renderSession } from '../commands/session.js';
import countdowns, { renderCountdown } from '../commands/countdowns.js';
import { personalCopy, personalPage } from '../shared/personalCopy.js';

const id = '3c805e6c-85f8-4874-9983-034aaef50bb8';
const task: UserTaskBoard = { id, userId: 'owner', title: 'Shopping', state: 'active', checklist: [{ text: 'Milk', done: false }], dueAt: null,
    timezone: 'Europe/Amsterdam', recurrence: null, reminderId: `task:${id}:0`, completedAt: null, completions: 0, version: 0 };
const active: UserSessionBoard = { id, userId: 'owner', title: 'Practice', kind: 'focus', state: 'running', phase: 'focus', pomodoro: true,
    cycleIndex: 1, cycles: 4, workMs: 120_000, breakElapsedMs: 60_000, phaseElapsedMs: 120_000, remainingMs: 1_380_000,
    startedAt: 1_800_000_000_000, endedAt: null, reminderId: `session:${id}:0`, version: 0 };
const countdown: UserCountdownBoard = { id, userId: 'owner', title: 'Launch', dueAt: 1_800_000_000_000, timezone: 'Europe/Amsterdam', advanceMinutes: 60 };
const manager = {
    userManager: { getUser: vi.fn().mockResolvedValue({ timezone: 'Europe/Amsterdam', preferredLocale: 'nl' }) },
    guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue('en') },
    userTaskManager: { create: vi.fn(), get: vi.fn(), list: vi.fn(), done: vi.fn(), snooze: vi.fn(), check: vi.fn(), remove: vi.fn() },
    userSessionManager: { start: vi.fn(), getActive: vi.fn(), transition: vi.fn(), stats: vi.fn() },
    userCountdownManager: { create: vi.fn(), get: vi.fn(), list: vi.fn(), remove: vi.fn() },
    reminderInteractionManager: { getDelivery: vi.fn(), recoverDelivery: vi.fn() },
};

function slash(action: string, values: Record<string, string | number | boolean> = {}) {
    return { user: { id: 'owner' }, guildId: 'guild', locale: 'en-US', deferReply: vi.fn(), editReply: vi.fn(), options: {
        getSubcommand: () => action, getString: (key: string) => typeof values[key] === 'string' ? values[key] : null,
        getInteger: (key: string) => typeof values[key] === 'number' ? values[key] : null,
        getBoolean: (key: string) => typeof values[key] === 'boolean' ? values[key] : null,
    } };
}

function button(customId: string, userId = 'owner') {
    return { customId, user: { id: userId }, guildId: null as string | null, locale: 'en-US', channelId: 'channel',
        message: { id: 'message', author: { id: 'bot' } }, client: { user: { id: 'bot' } }, deferUpdate: vi.fn(), editReply: vi.fn(), followUp: vi.fn() };
}

beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__FG_ACTIVE_CONFIG_MANAGER__ = manager;
    manager.userTaskManager.create.mockResolvedValue(task);
    manager.userTaskManager.get.mockResolvedValue(task);
    manager.userTaskManager.list.mockResolvedValue([task]);
    manager.userTaskManager.done.mockResolvedValue({ ...task, state: 'completed', version: 1 });
    manager.userTaskManager.snooze.mockResolvedValue({ ...task, version: 1 });
    manager.userTaskManager.check.mockResolvedValue({ ...task, version: 1, checklist: [{ text: 'Milk', done: true }] });
    manager.userTaskManager.remove.mockResolvedValue(true);
    manager.userSessionManager.start.mockResolvedValue(active);
    manager.userSessionManager.getActive.mockResolvedValue(active);
    manager.userSessionManager.transition.mockResolvedValue({ ...active, state: 'paused', version: 1 });
    manager.userSessionManager.stats.mockResolvedValue({ focusMs: 120_000, gamingMs: 60_000, breakMs: 60_000, sessions: 2 });
    manager.userCountdownManager.create.mockResolvedValue(countdown);
    manager.userCountdownManager.get.mockResolvedValue(countdown);
    manager.userCountdownManager.list.mockResolvedValue([countdown]);
    manager.userCountdownManager.remove.mockResolvedValue(true);
    manager.reminderInteractionManager.getDelivery.mockResolvedValue({ id: 'delivery', status: 'delivered', messageId: 'message', channelId: 'channel' });
});

describe('private task commands and controls', () => {
    it('creates a checklist using saved personal timezone/locale and defers privately before persistence', async () => {
        const interaction = slash('add', { title: 'Shopping', checklist: 'Milk|Bread', due: '1h', repeat: 'daily' });
        await tasks.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(interaction.deferReply.mock.invocationCallOrder[0]).toBeLessThan(manager.userTaskManager.create.mock.invocationCallOrder[0]!);
        expect(manager.userTaskManager.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', checklist: ['Milk', 'Bread'], timezone: 'Europe/Amsterdam', recurrence: { unit: 'day', interval: 1, timezone: 'Europe/Amsterdam' } }));
        expect(manager.guildLocaleConfigManager.getOutputLocale).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Milk') }));
    });

    it.each(['show', 'done', 'snooze', 'check', 'delete', 'list'])('handles the %s slash action privately', async action => {
        const interaction = slash(action, { task: id, when: '10m', item: 1, completed: true, page: 1 });
        await tasks.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.editReply).toHaveBeenCalled();
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    });

    it.each(['d', 's', 'c'])('acknowledges %s controls then passes actual owner and version', async action => {
        const interaction = button(`user-task:${action}:${id}:0${action === 'c' ? ':0' : ''}`);
        await tasks.handleComponent(interaction as unknown as ButtonInteraction);
        const method = action === 'd' ? manager.userTaskManager.done : action === 's' ? manager.userTaskManager.snooze : manager.userTaskManager.check;
        expect(method.mock.calls[0]?.slice(0, 3)).toEqual([id, 'owner', 0]);
        expect(interaction.deferUpdate.mock.invocationCallOrder[0]).toBeLessThan(method.mock.invocationCallOrder[0]!);
        expect(interaction.editReply).toHaveBeenCalled();
    });

    it('binds delivered controls to a private DM and refuses copied or cross-user controls', async () => {
        const original = button(`user-task:d:${id}:0:delivery`);
        await tasks.handleComponent(original as unknown as ButtonInteraction);
        expect(manager.userTaskManager.done).toHaveBeenCalledWith(id, 'owner', 0, { id: 'delivery', messageId: 'message', channelId: 'channel' });
        manager.userTaskManager.done.mockClear();
        manager.reminderInteractionManager.getDelivery.mockResolvedValue(null);
        const other = button(`user-task:d:${id}:0:delivery`, 'other');
        await tasks.handleComponent(other as unknown as ButtonInteraction);
        expect(manager.userTaskManager.done).not.toHaveBeenCalled();
        expect(other.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
        manager.reminderInteractionManager.getDelivery.mockResolvedValue({ status: 'delivered', messageId: 'elsewhere', channelId: 'channel' });
        await tasks.handleComponent(original as unknown as ButtonInteraction);
        expect(manager.userTaskManager.done).not.toHaveBeenCalled();
    });

    it('recovers an uncertain bot-authored DM binding after restart, rejects guild delivery controls and stale transitions', async () => {
        manager.reminderInteractionManager.getDelivery.mockResolvedValue({ status: 'uncertain' });
        manager.reminderInteractionManager.recoverDelivery.mockResolvedValue({ id: 'delivery', messageId: 'message', channelId: 'channel' });
        const interaction = button(`user-task:s:${id}:0:delivery`);
        await tasks.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.reminderInteractionManager.recoverDelivery).toHaveBeenCalledWith('delivery', 'owner', 'message', 'channel');
        interaction.guildId = 'guild';
        manager.userTaskManager.snooze.mockClear();
        await tasks.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.userTaskManager.snooze).not.toHaveBeenCalled();
        manager.userTaskManager.done.mockRejectedValueOnce(new PersonalError('stale'));
        const stale = button(`user-task:d:${id}:0`);
        await tasks.handleComponent(stale as unknown as ButtonInteraction);
        expect(stale.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: personalCopy('nl')('errors.stale') }));
    });

    it('rejects invalid dates and renders every checklist toggle with bounded content in both locales', async () => {
        const invalid = slash('add', { title: 'Title', due: 'wrong' });
        await tasks.execute(invalid as unknown as ChatInputCommandInteraction);
        expect(manager.userTaskManager.create).not.toHaveBeenCalled();
        for (const locale of ['en', 'nl'] as const) {
            const rendered = renderTask({ ...task, title: 'x'.repeat(120), checklist: Array.from({ length: 10 }, () => ({ text: 'y'.repeat(120), done: false })), dueAt: countdown.dueAt,
                recurrence: { unit: 'day', interval: 1, timezone: task.timezone }, completedAt: countdown.dueAt }, locale);
            expect(rendered.content.length).toBeLessThanOrEqual(2000);
            expect(rendered.components).toHaveLength(3);
            expect(renderTask({ ...task, state: 'completed' }, locale).components).toEqual([]);
        }
    });
});

describe('private sessions and countdowns', () => {
    it('starts configured Pomodoro using personal alert copy', async () => {
        const interaction = slash('start', { kind: 'focus', title: 'Practice', minutes: 25, pomodoro: true, 'break-minutes': 5, cycles: 4 });
        await session.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(manager.userSessionManager.start).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', kind: 'focus', minutes: 25, pomodoro: true, cycles: 4, messages: expect.objectContaining({ break: personalCopy('nl')('session.alertBreak', { title: 'Practice' }) }) }));
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    });

    it.each(['status', 'pause', 'resume', 'stop', 'stats'])('handles session %s', async action => {
        const interaction = slash(action);
        await session.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.editReply).toHaveBeenCalled();
    });

    it.each(['pause', 'resume', 'stop'])('passes version and owner for %s buttons and replaces controls', async action => {
        const interaction = button(`user-session:${action}:${id}:0`);
        await session.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.userSessionManager.transition).toHaveBeenCalledWith(id, 'owner', 0, action);
        expect(interaction.editReply).toHaveBeenCalled();
        expect(renderSession({ ...active, state: 'stopped' }, 'nl').components).toEqual([]);
    });

    it('reports unauthorized session controls privately and handles no active session', async () => {
        manager.userSessionManager.transition.mockRejectedValueOnce(new PersonalError('missing'));
        const interaction = button(`user-session:stop:${id}:0`, 'other');
        await session.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
        manager.userSessionManager.getActive.mockResolvedValueOnce(null);
        const empty = slash('status');
        await session.execute(empty as unknown as ChatInputCommandInteraction);
        expect(empty.editReply).toHaveBeenCalledWith({ content: personalCopy('nl')('session.none'), components: [] });
    });

    it('creates exact countdown alerts with saved timezone and optional advance minutes', async () => {
        const interaction = slash('add', { title: 'Launch', at: '2090-12-25 09:00', 'advance-minutes': 60 });
        await countdowns.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(manager.userCountdownManager.create).not.toHaveBeenCalled();
        const future = new Date(Date.now() + 86_400_000).toISOString();
        await countdowns.execute(slash('add', { title: 'Launch', at: future, 'advance-minutes': 60 }) as unknown as ChatInputCommandInteraction);
        expect(manager.userCountdownManager.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', timezone: 'Europe/Amsterdam', advanceMinutes: 60 }));
    });

    it.each(['list', 'show', 'delete'])('handles countdown %s and preserves private replies', async action => {
        const interaction = slash(action, { countdown: id, page: 1 });
        await countdowns.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(interaction.editReply).toHaveBeenCalled();
    });

    it('bounds upcoming pages even at maximum title length and clamps page selection', () => {
        const items = Array.from({ length: 100 }, () => ({ ...countdown, title: 'x'.repeat(120) }));
        const page = personalPage(items, 0);
        expect(page).toMatchObject({ page: 1, pages: 17 });
        expect(page.items.map(item => renderCountdown(item, 'nl')).join('\n').length).toBeLessThan(1950);
        expect(personalPage(items, 99).page).toBe(17);
    });
});
