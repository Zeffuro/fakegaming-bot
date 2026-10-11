import type { ScheduleRecord, UserCountdownBoard, UserTaskBoard } from '@zeffuro/fakegaming-common/managers';
import type { PersonalToday } from '@zeffuro/fakegaming-common/api';

export interface AgendaReminder {
    id: string; message: string; timestamp: number | string; completed?: boolean | number | string | null;
}

export function validAgendaTimezone(value: string | null | undefined): string {
    try {
        new Intl.DateTimeFormat('en', { timeZone: value || 'UTC' });
        return value || 'UTC';
    } catch { return 'UTC'; }
}

export function agendaDate(timestamp: number, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(timestamp);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function buildTodayAgenda(input: {
    now: number; timezone: string; tasks: UserTaskBoard[]; reminders: AgendaReminder[];
    schedules: ScheduleRecord[]; countdowns: UserCountdownBoard[]; enabledScheduleIds: Set<string>;
}): Omit<PersonalToday, 'session'> {
    const { now, timezone } = input;
    const day = agendaDate(now, timezone);
    const dueByToday = (at: number) => Number.isFinite(at) && agendaDate(at, timezone) <= day;
    const tasks = input.tasks.filter(task => task.state === 'active' && (task.dueAt === null || dueByToday(task.dueAt)))
        .map(task => ({
            id: task.id, title: task.title, dueAt: task.dueAt, checklist: task.checklist, version: task.version,
            recurring: task.recurrence !== null,
            sourceUrl: 'sourceUrl' in task && typeof task.sourceUrl === 'string' ? task.sourceUrl : null,
        }));
    const reminders = input.reminders.filter(reminder =>
        ![true, 1, '1', 'true'].includes(reminder.completed ?? false)
        && !/^(task|session|countdown):/.test(reminder.id)
        && dueByToday(Number(reminder.timestamp)))
        .map(reminder => ({ id: reminder.id, title: reminder.message, dueAt: Number(reminder.timestamp) }));
    const schedules = input.schedules.filter(item => item.state === 'pending' && !item.cancelled
        && input.enabledScheduleIds.has(item.scheduleId)
        && (item.allDay ? agendaDate(item.plannedAt, validAgendaTimezone(item.timezone)) <= day : dueByToday(item.plannedAt)))
        .map(item => ({
            id: item.id, title: item.title, plannedAt: item.plannedAt, endAt: item.endAt,
            allDay: item.allDay, timezone: item.timezone, version: item.version, nextNotifyAt: item.nextNotifyAt,
        }));
    const countdowns = input.countdowns.map(item => ({ id: item.id, title: item.title, dueAt: item.dueAt }));
    return { now, day, timezone, tasks, reminders, schedules, countdowns };
}
