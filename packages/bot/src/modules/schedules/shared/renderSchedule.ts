import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { getOutputLocaleMetadata, type SupportedOutputLocale } from '../../../core/localization.js';
import { scheduleCopy } from './scheduleCopy.js';

export type ScheduleOccurrence = NonNullable<Awaited<ReturnType<ReturnType<typeof getConfigManager>['userScheduleManager']['get']>>>;

export function scheduleTime(timestamp: number, timezone: string, locale: SupportedOutputLocale): string {
    return new Intl.DateTimeFormat(getOutputLocaleMetadata(locale).formatTag, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

function scheduleStatus(item: ScheduleOccurrence, locale: SupportedOutputLocale): string {
    const t = scheduleCopy(locale);
    if (item.completedAt !== null) return t('completed', { time: scheduleTime(item.completedAt, item.timezone, locale) });
    if (item.state === 'completed') return t('done');
    if (item.nextNotifyAt !== null && item.nextNotifyAt > Date.now() && item.nextNotifyAt !== item.plannedAt) {
        return t('reminderAt', { time: scheduleTime(item.nextNotifyAt, item.timezone, locale) });
    }
    return t('pending');
}

export function renderSchedule(item: ScheduleOccurrence, locale: SupportedOutputLocale) {
    const t = scheduleCopy(locale);
    const lines = [item.title, t('planned', { time: scheduleTime(item.plannedAt, item.timezone, locale), timezone: item.timezone }),
        scheduleStatus(item, locale)];
    if (item.cancelled) lines.push(t('cancelled'));
    if (item.allDay) lines.push(t('allDay'));
    if (item.note) lines.push(item.note);
    lines.push(t('id', { id: item.id, scheduleId: item.scheduleId }));
    const button = (action: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder()
        .setCustomId(`schedule:${action}:${item.id}:${item.version}`).setLabel(label).setStyle(style);
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const pending = item.state === 'pending' && !item.cancelled;
    if (item.state === 'completed') rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button('u', t('undo'))));
    else if (pending) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button('a', t('done'), ButtonStyle.Success), button('s', t('later'))));
    const details = [button('h', t('history')), button('n', t('note'))];
    if (item.completedAt !== null) details.unshift(button('t', t('earlier')));
    else if (pending) details.unshift(button('t', t('log')));
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(details));
    return { content: lines.join('\n').slice(0, 2000), components: rows, allowedMentions: { parse: [] as never[] } };
}

export function renderHistory(items: readonly ScheduleOccurrence[], locale: SupportedOutputLocale, requestedPage = 1) {
    const t = scheduleCopy(locale);
    const pages = Math.max(1, Math.ceil(items.length / 4));
    const page = Math.max(1, Math.min(requestedPage, pages));
    const selected = items.slice((page - 1) * 4, page * 4);
    return { content: selected.length ? [...selected.map(item => [item.title.slice(0, 120),
        t('planned', { time: scheduleTime(item.plannedAt, item.timezone, locale), timezone: item.timezone }),
        scheduleStatus(item, locale),
        ...(item.cancelled ? [t('cancelled')] : []),
        ...(item.allDay ? [t('allDay')] : []),
        t('id', { id: item.id, scheduleId: item.scheduleId })].join('\n')), t('page', { page, pages })].join('\n\n').slice(0, 2000)
        : t('empty'), components: [], allowedMentions: { parse: [] as never[] } };
}
