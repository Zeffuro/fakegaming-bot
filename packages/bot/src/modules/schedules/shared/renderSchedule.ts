import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { getOutputLocaleMetadata, type SupportedOutputLocale } from '../../../core/localization.js';
import { scheduleCopy } from './scheduleCopy.js';

export type ScheduleOccurrence = NonNullable<Awaited<ReturnType<ReturnType<typeof getConfigManager>['userScheduleManager']['get']>>>;

export function scheduleTime(timestamp: number, timezone: string, locale: SupportedOutputLocale): string {
    return new Intl.DateTimeFormat(getOutputLocaleMetadata(locale).formatTag, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

export function renderSchedule(item: ScheduleOccurrence, locale: SupportedOutputLocale) {
    const t = scheduleCopy(locale);
    const lines = [item.title, t('planned', { time: scheduleTime(item.plannedAt, item.timezone, locale), timezone: item.timezone }),
        item.completedAt === null ? t('pending') : t('completed', { time: scheduleTime(item.completedAt, item.timezone, locale) })];
    if (item.cancelled) lines.push(t('cancelled'));
    if (item.allDay) lines.push(t('allDay'));
    if (item.note) lines.push(item.note);
    lines.push(t('id', { id: item.id, scheduleId: item.scheduleId }));
    const button = (action: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder()
        .setCustomId(`schedule:${action}:${item.id}:${item.version}`).setLabel(label).setStyle(style);
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    if (!item.cancelled || item.state === 'completed') rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...(item.state === 'pending' ? [button('d', t('taken'), ButtonStyle.Success)] : [button('u', t('undo'))]),
        button('t', t('earlier')),
        ...(item.state === 'pending' ? [button('s', t('later'))] : []),
    ));
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button('h', t('history')), button('n', t('note'))));
    return { content: lines.join('\n').slice(0, 2000), components: rows, allowedMentions: { parse: [] as never[] } };
}

export function renderHistory(items: readonly ScheduleOccurrence[], locale: SupportedOutputLocale, requestedPage = 1) {
    const t = scheduleCopy(locale);
    const pages = Math.max(1, Math.ceil(items.length / 4));
    const page = Math.max(1, Math.min(requestedPage, pages));
    const selected = items.slice((page - 1) * 4, page * 4);
    return { content: selected.length ? [...selected.map(item => [item.title.slice(0, 120),
        t('planned', { time: scheduleTime(item.plannedAt, item.timezone, locale), timezone: item.timezone }),
        item.completedAt === null ? t('pending') : t('completed', { time: scheduleTime(item.completedAt, item.timezone, locale) }),
        ...(item.cancelled ? [t('cancelled')] : []),
        ...(item.allDay ? [t('allDay')] : []),
        t('id', { id: item.id, scheduleId: item.scheduleId })].join('\n')), t('page', { page, pages })].join('\n\n').slice(0, 2000)
        : t('empty'), components: [], allowedMentions: { parse: [] as never[] } };
}
