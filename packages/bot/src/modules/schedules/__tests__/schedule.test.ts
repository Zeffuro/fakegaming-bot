import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction, type ModalSubmitInteraction } from 'discord.js';
import schedule from '../commands/schedule.js';
import { parseCompletedTime } from '../shared/completedTime.js';
import { renderHistory, renderSchedule } from '../shared/renderSchedule.js';
import { personalDashboardUrl, scheduleCopy, scheduleFailure } from '../shared/scheduleCopy.js';

const id = '3c805e6c-85f8-4874-9983-034aaef50bb8';
const item = { id, userId: 'owner', scheduleId: id, title: 'Private schedule', timezone: 'Europe/Amsterdam', plannedAt: 1_800_000_000_000,
    endAt: null, allDay: false, cancelled: false, state: 'pending' as const, completedAt: null, note: '', version: 0,
    nextNotifyAt: null, notificationCount: 0, sourceId: null };
const manager = {
    userManager: { getUser: vi.fn().mockResolvedValue({ preferredLocale: 'nl', timezone: item.timezone }) },
    guildLocaleConfigManager: { getOutputLocale: vi.fn() },
    userScheduleManager: { get: vi.fn(), createManual: vi.fn(), list: vi.fn(), complete: vi.fn(), undo: vi.fn(), snooze: vi.fn(), note: vi.fn(),
        summary: vi.fn(), export: vi.fn(), preferences: vi.fn(), configure: vi.fn(), setEnabled: vi.fn() },
};

function slash(action: string, values: Record<string, string | number | boolean> = {}) {
    return { user: { id: 'owner' }, guildId: 'guild', locale: 'en-US', deferReply: vi.fn(), editReply: vi.fn(), options: {
        getSubcommand: () => action, getString: (key: string) => typeof values[key] === 'string' ? values[key] : null,
        getInteger: (key: string) => typeof values[key] === 'number' ? values[key] : null,
        getBoolean: (key: string) => typeof values[key] === 'boolean' ? values[key] : null,
    } };
}

function control(action: string, value = '') {
    return { customId: `schedule:${action}:${id}:0`, user: { id: 'owner' }, guildId: null as string | null, locale: 'en-US',
        client: { user: { id: 'bot' } }, message: { author: { id: 'bot' }, flags: { has: vi.fn().mockReturnValue(false) }, edit: vi.fn().mockResolvedValue(undefined) },
        fields: { getTextInputValue: () => value }, deferReply: vi.fn(), reply: vi.fn(), editReply: vi.fn(), showModal: vi.fn() };
}

beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__FG_ACTIVE_CONFIG_MANAGER__ = manager;
    const m = manager.userScheduleManager;
    m.get.mockResolvedValue(item);
    m.createManual.mockResolvedValue(item);
    m.list.mockResolvedValue([item]);
    m.complete.mockResolvedValue({ ...item, state: 'completed', completedAt: Date.now(), version: 1 });
    m.undo.mockResolvedValue({ ...item, version: 1 });
    m.snooze.mockResolvedValue({ ...item, version: 1 });
    m.note.mockResolvedValue({ ...item, note: 'note', version: 1 });
    m.summary.mockResolvedValue({ last: null, next: item, unconfirmed: 2 });
    m.export.mockResolvedValue('private export');
    m.preferences.mockResolvedValue({ timezone: item.timezone, quietStart: null, quietEnd: null, followupMinutes: 60, maxFollowups: 2 });
    m.setEnabled.mockResolvedValue(true);
});

describe('completion timestamps', () => {
    const now = Date.parse('2026-12-01T00:00:00Z');
    it('parses exact past local and explicit offset dates', () => {
        expect(parseCompletedTime('2026-10-07 09:00', item.timezone, now)).toBe(Date.parse('2026-10-07T07:00:00Z'));
        expect(parseCompletedTime('2026-10-25T02:30:00+02:00', item.timezone, now)).toBe(Date.parse('2026-10-25T00:30:00Z'));
    });
    it.each(['2026-10-25 02:30', '2026-03-29 02:30', '2026-02-30 12:00', '2027-01-01 09:00', '09:00', 'yesterday', '2026-13-01 12:00'])('rejects ambiguous, missing, malformed or future time %s', input => {
        expect(parseCompletedTime(input, item.timezone, now)).toBeNull();
    });
    it('rejects an invalid timezone and impossible clock values', () => {
        expect(parseCompletedTime('2026-10-07 09:00', 'wrong', now)).toBeNull();
        expect(parseCompletedTime('2026-10-07T25:00Z', 'UTC', now)).toBeNull();
    });
});

describe('private schedule commands', () => {
    it('validates dashboard URL protocols and routes to the personal page', () => {
        vi.stubEnv('DASHBOARD_URL', 'https://example.test/base?secret=discard#discard');
        expect(personalDashboardUrl()).toBe('https://example.test/base/dashboard/me');
        vi.stubEnv('DASHBOARD_URL', 'javascript:alert(1)');
        expect(personalDashboardUrl()).toBeNull();
        vi.unstubAllEnvs();
    });
    it('maps persistence failures into private localized copy', () => {
        for (const code of ['invalid', 'missing', 'stale', 'capacity', 'failure'] as const) {
            expect(scheduleFailure({ code }, 'nl')).toBe(scheduleCopy('nl')(code));
        }
        expect(scheduleFailure(new Error('database'), 'en')).toBe(scheduleCopy('en')('failure'));
    });
    it('creates a fixed weekly schedule with saved timezone and locale', async () => {
        const interaction = slash('add', { title: 'Private schedule', at: new Date(Date.now() + 86_400_000).toISOString(), 'repeat-weeks': 2 });
        await schedule.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(manager.userScheduleManager.createManual).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', timezone: item.timezone, repeatWeeks: 2 }));
        expect(manager.guildLocaleConfigManager.getOutputLocale).not.toHaveBeenCalled();
    });
    it.each(['show', 'list', 'complete', 'snooze', 'undo', 'note', 'history', 'summary', 'pause', 'resume', 'configure', 'connect'])('handles %s privately', async action => {
        const interaction = slash(action, { occurrence: id, schedule: id, when: '10m' });
        await schedule.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(interaction.editReply).toHaveBeenCalled();
    });
    it.each(['json', 'csv'])('exports all owner history in %s as a private attachment', async format => {
        const interaction = slash('export', { format });
        await schedule.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(manager.userScheduleManager.export).toHaveBeenCalledWith('owner', format);
        const payload = interaction.editReply.mock.calls[0]![0];
        expect(payload.files[0].name).toBe(`schedule-history.${format}`);
        expect(payload.files[0].attachment.toString()).toBe('private export');
    });
    it('reports an oversized full export without truncating history', async () => {
        manager.userScheduleManager.export.mockResolvedValueOnce('x'.repeat(8_000_001));
        const interaction = slash('export', { format: 'json' });
        await schedule.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: scheduleCopy('nl')('exportTooLarge') }));
    });
    it('rejects future completion, missing occurrences and partial quiet hours', async () => {
        await schedule.execute(slash('complete', { occurrence: id, at: '2090-01-01 09:00' }) as unknown as ChatInputCommandInteraction);
        expect(manager.userScheduleManager.complete).not.toHaveBeenCalled();
        await schedule.execute(slash('configure', { 'quiet-start': '23:00' }) as unknown as ChatInputCommandInteraction);
        expect(manager.userScheduleManager.configure).not.toHaveBeenCalled();
        manager.userScheduleManager.get.mockResolvedValue(null);
        const missing = slash('show', { occurrence: id });
        await schedule.execute(missing as unknown as ChatInputCommandInteraction);
        expect(missing.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: scheduleCopy('nl')('missing') }));
    });
    it('corrects only completed occurrences using the exact past timestamp', async () => {
        manager.userScheduleManager.get.mockResolvedValue({ ...item, state: 'completed', completedAt: Date.now() });
        await schedule.execute(slash('correct', { occurrence: id, at: '2026-01-01 09:00' }) as unknown as ChatInputCommandInteraction);
        expect(manager.userScheduleManager.complete).toHaveBeenCalledWith(id, 'owner', 0, Date.parse('2026-01-01T08:00:00Z'));
    });
});

describe('persistent private occurrence controls', () => {
    it('leaves unrelated components and modals for other handlers', async () => {
        const interaction = control('d');
        interaction.customId = 'other:component';
        expect(await schedule.handleComponent(interaction as unknown as ButtonInteraction)).toBe(false);
        expect(await schedule.handleModal(interaction as unknown as ModalSubmitInteraction)).toBe(false);
        expect(interaction.deferReply).not.toHaveBeenCalled();
    });
    it.each(['t', 's', 'n'])('opens %s modal without a prior deferral', async action => {
        const interaction = control(action);
        await schedule.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.showModal).toHaveBeenCalled();
        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(interaction.showModal.mock.calls[0]![0].data.custom_id).toBe(interaction.customId);
    });
    it.each(['d', 'u', 'h'])('handles %s with owner and current version', async action => {
        const interaction = control(action);
        await schedule.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(interaction.editReply).toHaveBeenCalled();
        if (action === 'd') expect(manager.userScheduleManager.complete).toHaveBeenCalledWith(id, 'owner', 0);
    });
    it.each(['t', 's', 'n'])('persists explicit %s modal input', async action => {
        const interaction = control(action, action === 't' ? '2026-01-01 09:00' : action === 's' ? '10m' : 'private note');
        await schedule.handleModal(interaction as unknown as ModalSubmitInteraction);
        expect(interaction.editReply).toHaveBeenCalled();
        const method = action === 't' ? manager.userScheduleManager.complete : action === 's' ? manager.userScheduleManager.snooze : manager.userScheduleManager.note;
        expect(method.mock.calls[0]!.slice(0, 3)).toEqual([id, 'owner', 0]);
    });
    it.each(['other-owner', 'stale', 'public', 'wrong-author', 'malformed'])('rejects %s control before mutation or modal', async kind => {
        const interaction = control('t');
        if (kind === 'other-owner') interaction.user.id = 'other';
        if (kind === 'stale') manager.userScheduleManager.get.mockResolvedValue({ ...item, version: 1 });
        if (kind === 'public') interaction.guildId = 'guild';
        if (kind === 'wrong-author') interaction.message.author.id = 'other';
        if (kind === 'malformed') interaction.customId += ':extra';
        await schedule.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.showModal).not.toHaveBeenCalled();
        expect(manager.userScheduleManager.complete).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
    });
    it('rechecks a stale modal after another explicit action', async () => {
        manager.userScheduleManager.get.mockResolvedValue({ ...item, version: 1 });
        const interaction = control('t', '2026-01-01 09:00');
        await schedule.handleModal(interaction as unknown as ModalSubmitInteraction);
        expect(manager.userScheduleManager.complete).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: scheduleCopy('nl')('stale') }));
    });
    it('rejects future completion and invalid reminder modal times', async () => {
        for (const action of ['t', 's']) {
            const interaction = control(action, action === 't' ? '2090-01-01 09:00' : 'not a time');
            await schedule.handleModal(interaction as unknown as ModalSubmitInteraction);
            expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: scheduleCopy('nl')('invalid') }));
        }
        expect(manager.userScheduleManager.complete).not.toHaveBeenCalled();
        expect(manager.userScheduleManager.snooze).not.toHaveBeenCalled();
    });
    it('accepts only private bot messages in guilds and reports transaction races', async () => {
        const interaction = control('d');
        interaction.guildId = 'guild';
        interaction.message.flags.has.mockReturnValue(true);
        manager.userScheduleManager.complete.mockRejectedValueOnce({ code: 'stale' });
        await schedule.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: scheduleCopy('nl')('stale') }));
        expect(interaction.message.edit).not.toHaveBeenCalled();
    });
    it('renders undo and note without completing cancelled occurrences', () => {
        for (const locale of ['en', 'nl'] as const) {
            expect(renderSchedule({ ...item, state: 'completed', completedAt: Date.now() }, locale).components[0]!.components[0]!.data).toMatchObject({ custom_id: `schedule:u:${id}:0` });
            expect(renderSchedule({ ...item, cancelled: true }, locale).components).toHaveLength(1);
            const completed = { ...item, allDay: true, cancelled: true, state: 'completed' as const, completedAt: Date.now() };
            const view = renderSchedule(completed, locale);
            expect(view.content).toContain(scheduleCopy(locale)('allDay'));
            expect(view.components[0]!.components.map(button => button.data)).toEqual([
                expect.objectContaining({ custom_id: `schedule:u:${id}:0` }), expect.objectContaining({ custom_id: `schedule:t:${id}:0` }),
            ]);
            expect(renderHistory([completed], locale).content).toContain(scheduleCopy(locale)('allDay'));
        }
    });
});
