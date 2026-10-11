import { describe, expect, it } from 'vitest';
import type { ScheduleRecord, UserTaskBoard } from '@zeffuro/fakegaming-common/managers';
import { agendaDate, buildTodayAgenda, validAgendaTimezone } from '../agenda.js';

const now = Date.parse('2026-10-09T22:30:00Z');
const task = (overrides: Partial<UserTaskBoard> = {}): UserTaskBoard => ({
    id: 'task', userId: 'owner', title: 'Task', state: 'active', checklist: [], dueAt: now,
    timezone: 'UTC', recurrence: null, reminderId: null, completedAt: null, completions: 0,
    version: 0, canUndo: false, sourceNoteId: null, sourceUrl: null, ...overrides,
});
const schedule = (overrides: Partial<ScheduleRecord> = {}): ScheduleRecord => ({
    id: 'occurrence', userId: 'owner', scheduleId: 'schedule', title: 'Calendar', timezone: 'UTC',
    plannedAt: now, endAt: null, allDay: false, cancelled: false, state: 'pending', completedAt: null,
    note: 'private note', version: 0, nextNotifyAt: now, notificationCount: 0, sourceId: 'private-source', ...overrides,
});
const input = () => ({ now, timezone: 'Europe/Amsterdam', tasks: [] as UserTaskBoard[], reminders: [],
    schedules: [] as ScheduleRecord[], countdowns: [], enabledScheduleIds: new Set(['schedule']) });

describe('Today agenda date and filtering', () => {
    it('uses the saved timezone around midnight and both DST transitions', () => {
        expect(agendaDate(now, 'Europe/Amsterdam')).toBe('2026-10-10');
        expect(agendaDate(now, 'America/Los_Angeles')).toBe('2026-10-09');
        for (const value of ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z']) expect(agendaDate(Date.parse(value), 'Europe/Amsterdam')).toBe('2026-03-29');
        for (const value of ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z']) expect(agendaDate(Date.parse(value), 'Europe/Amsterdam')).toBe('2026-10-25');
        expect(validAgendaTimezone('Not/AZone')).toBe('UTC');
        expect(validAgendaTimezone(null)).toBe('UTC');
        expect(validAgendaTimezone('Europe/Amsterdam')).toBe('Europe/Amsterdam');
    });
    it('keeps overdue, today and undated active tasks but excludes future/completed tasks', () => {
        const result = buildTodayAgenda({ ...input(), tasks: [
            task({ id: 'overdue', dueAt: now - 86_400_000 }), task({ id: 'today', dueAt: now + 3_600_000 }),
            task({ id: 'undated', dueAt: null }), task({ id: 'future', dueAt: now + 2 * 86_400_000 }),
            task({ id: 'done', state: 'completed' }),
        ] });
        expect(result.tasks.map(item => item.id)).toEqual(['overdue', 'today', 'undated']);
    });
    it('does not duplicate task/session/countdown reminders or show paused reminders', () => {
        const result = buildTodayAgenda({ ...input(), reminders: [
            { id: 'plain', message: 'Plain', timestamp: String(now) },
            ...['task:x:1', 'session:x:1', 'countdown:x:due'].map(id => ({ id, message: 'internal', timestamp: now })),
            ...[true, 1, '1', 'true'].map((completed, index) => ({ id: `paused${index}`, message: 'paused', timestamp: now, completed })),
            { id: 'future', message: 'Future', timestamp: now + 3 * 86_400_000 },
            { id: 'bad', message: 'Invalid', timestamp: 'invalid' },
        ] });
        expect(result.reminders).toEqual([{ id: 'plain', title: 'Plain', dueAt: now }]);
    });
    it('preserves all-day calendar dates and excludes disabled/cancelled/completed occurrences', () => {
        const result = buildTodayAgenda({ ...input(), timezone: 'America/Los_Angeles', schedules: [
            schedule({ id: 'all-day-future', allDay: true, timezone: 'Europe/Amsterdam', plannedAt: Date.parse('2026-10-09T22:00:00Z') }),
            schedule({ id: 'all-day-today', allDay: true, timezone: 'Europe/Amsterdam', plannedAt: Date.parse('2026-10-08T22:00:00Z') }),
            schedule({ id: 'disabled', scheduleId: 'disabled' }), schedule({ id: 'cancelled', cancelled: true }),
            schedule({ id: 'completed', state: 'completed' }),
            schedule({ id: 'future', plannedAt: now + 2 * 86_400_000 }),
        ] });
        expect(result.schedules.map(item => item.id)).toEqual(['all-day-today']);
        expect(result.schedules[0]).not.toHaveProperty('note');
        expect(result.schedules[0]).not.toHaveProperty('sourceId');
    });
    it('retains task source links and countdowns without internal ownership/delivery fields', () => {
        const result = buildTodayAgenda({ ...input(), tasks: [task({ sourceUrl: 'https://discord.com/channels/1/2/3' })],
            countdowns: [{ id: 'countdown', userId: 'owner', title: 'Holiday', dueAt: now + 86_400_000, timezone: 'UTC', advanceMinutes: null }] });
        expect(result.tasks[0].sourceUrl).toBe('https://discord.com/channels/1/2/3');
        expect(result.tasks[0]).not.toHaveProperty('userId');
        expect(result.countdowns[0]).toEqual({ id: 'countdown', title: 'Holiday', dueAt: now + 86_400_000 });
    });
});
