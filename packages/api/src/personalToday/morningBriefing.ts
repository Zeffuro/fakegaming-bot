import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { CalendarConnection, CalendarSource, PersonalSchedule } from '@zeffuro/fakegaming-common/models';
import { getOutputLocaleMetadata, type SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import type { MorningBriefingPreview, PersonalToday } from '@zeffuro/fakegaming-common/api';
import { apiText } from '../localization/locale.js';
import { agendaDate, buildTodayAgenda, validAgendaTimezone } from './agenda.js';

export async function loadMorningAgenda(userId: string, timezone: string, now: number): Promise<Omit<PersonalToday, 'session'>> {
    const cm = getConfigManager();
    const [tasks, reminders, schedules, countdowns, enabled, connection, sources] = await Promise.all([
        cm.userTaskManager.list(userId), cm.reminderManager.listForUser(userId), cm.userScheduleManager.list(userId, 'all'),
        cm.userCountdownManager.list(userId), PersonalSchedule.findAll({ where: { userId, enabled: true }, attributes: ['id', 'sourceId'] }),
        CalendarConnection.findByPk(userId, { attributes: ['status'] }),
        CalendarSource.findAll({ where: { userId, enabled: true }, attributes: ['id'] }),
    ]);
    const activeSources = new Set(sources.map(row => row.id));
    const enabledScheduleIds = new Set(enabled.filter(row => row.sourceId === null
        || (connection?.status === 'connected' && activeSources.has(row.sourceId))).map(row => row.id));
    const agenda = buildTodayAgenda({ now, timezone, tasks, reminders, schedules, countdowns, enabledScheduleIds });
    return { ...agenda, countdowns: agenda.countdowns.filter(row => agendaDate(row.dueAt, timezone) === agenda.day) };
}

function safeTitle(title: string): string {
    return title.replace(/[\r\n<>]/g, ' ').replace(/([\\*_`~|\[\]])/g, '\\$1').slice(0, 180);
}

export function formatMorningBriefing(agenda: Omit<PersonalToday, 'session'>, locale: SupportedOutputLocale): MorningBriefingPreview {
    const time = (at: number) => new Intl.DateTimeFormat(getOutputLocaleMetadata(locale).formatTag, {
        timeZone: agenda.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(at);
    const due = (at: number | null) => at === null ? apiText(locale, 'briefingUndated')
        : agendaDate(at, agenda.timezone) < agenda.day ? apiText(locale, 'briefingOverdue') : time(at);
    const scheduleDate = (row: PersonalToday['schedules'][number]) => row.allDay
        ? `${apiText(locale, 'briefingAllDay')}${agendaDate(row.plannedAt, validAgendaTimezone(row.timezone)) < agenda.day ? ` · ${apiText(locale, 'briefingOverdue')}` : ''}`
        : due(row.plannedAt);
    const lines = [
        ...agenda.tasks.map(row => `${apiText(locale, 'briefingTask')}: ${safeTitle(row.title)} — ${due(row.dueAt)}`),
        ...agenda.reminders.map(row => `${apiText(locale, 'briefingReminder')}: ${safeTitle(row.title)} — ${due(row.dueAt)}`),
        ...agenda.schedules.map(row => `${apiText(locale, 'briefingSchedule')}: ${safeTitle(row.title)} — ${scheduleDate(row)}`),
        ...agenda.countdowns.map(row => `${apiText(locale, 'briefingCountdown')}: ${safeTitle(row.title)} — ${time(row.dueAt)}`),
    ];
    const heading = apiText(locale, 'briefingHeading', { day: agenda.day, timezone: agenda.timezone });
    const selected: string[] = [];
    let content = heading;
    // Reserve footer space so the omitted count stays accurate.
    for (const line of lines) {
        const remaining = lines.length - selected.length - 1;
        const footer = remaining > 0 ? `\n${apiText(locale, 'briefingOmitted', { count: remaining })}` : '';
        const candidate = `${content}\n${line}`;
        if (candidate.length + footer.length > 1900) break;
        selected.push(line); content = candidate;
    }
    const omitted = lines.length - selected.length;
    if (omitted) content += `\n${apiText(locale, 'briefingOmitted', { count: omitted })}`;
    if (!lines.length) content += `\n${apiText(locale, 'briefingEmpty')}`;
    return { day: agenda.day, timezone: agenda.timezone, content, empty: lines.length === 0,
        total: lines.length, included: selected.length, omitted };
}
