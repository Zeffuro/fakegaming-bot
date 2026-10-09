import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { calendarDetailText, googleCalendarEventLink } from '@zeffuro/fakegaming-common/utils';
import { apiText } from '../localization/locale.js';
import type { PublicOccurrence } from './configuration.js';

const escapeTitle = (value: string) => value.replace(/[\\`*_{}\[\]()<>#|]/g, '\\$&');
const discordText = (value: string | null | undefined, limit: number) => {
    const text = calendarDetailText(value, limit);
    return text === null ? null : escapeTitle(text).slice(0, limit);
};

export function publicationDuration(row: PublicOccurrence, locale: SupportedOutputLocale): string | null {
    if (row.endAt === null || !Number.isFinite(row.endAt) || row.endAt <= row.plannedAt) return null;
    const minutes = Math.max(1, Math.ceil((row.endAt - row.plannedAt) / 60_000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes % 1440 / 60);
    const remaining = minutes % 60;
    return [days ? apiText(locale, 'calendarPublicDurationDays', { count: days }) : '',
        hours ? apiText(locale, 'calendarPublicDurationHours', { count: hours }) : '',
        remaining ? apiText(locale, 'calendarPublicDurationMinutes', { count: remaining }) : ''].filter(Boolean).join(' ');
}

export function publicationMessageDetails(row: PublicOccurrence, locale: SupportedOutputLocale) {
    return { title: discordText(row.title, 256) ?? '', url: googleCalendarEventLink(row.htmlLink), duration: publicationDuration(row, locale),
        location: discordText(row.location, 100), description: discordText(row.description, 1000) };
}

export function publicationMessage(row: PublicOccurrence, locale: SupportedOutputLocale, now: number): Record<string, unknown> {
    const seconds = Math.floor(row.plannedAt / 1000);
    const status = row.cancelled ? 'calendarPublicCancelled' : row.plannedAt <= now ? 'calendarPublicPast' : 'calendarPublicUpcoming';
    const fields = [{ name: apiText(locale, 'calendarPublicWhen'), value: `<t:${seconds}:F>\n<t:${seconds}:R>`, inline: false }];
    const details = publicationMessageDetails(row, locale);
    if (row.endAt !== null && row.endAt > row.plannedAt) fields.push({ name: apiText(locale, 'calendarPublicEnd'), value: `<t:${Math.floor(row.endAt / 1000)}:F>`, inline: false });
    if (details.duration) fields.push({ name: apiText(locale, 'calendarPublicDuration'), value: details.duration, inline: false });
    if (details.location) fields.push({ name: apiText(locale, 'calendarPublicLocationLabel'), value: details.location, inline: false });
    if (details.description) fields.push({ name: apiText(locale, 'calendarPublicDescription'), value: details.description, inline: false });
    if (row.allDay) fields.push({ name: apiText(locale, 'calendarPublicType'), value: apiText(locale, 'calendarPublicAllDay'), inline: false });
    return { content: '', allowed_mentions: { parse: [] }, components: [], embeds: [{ title: details.title, ...(details.url ? { url: details.url } : {}),
        description: apiText(locale, status), color: row.cancelled ? 0xE05A61 : 0x28B6D4, fields,
        footer: { text: apiText(locale, 'calendarPublicTimezone', { timezone: row.timezone }) } }] };
}

export function publicationEvent(row: PublicOccurrence, locale: SupportedOutputLocale): Record<string, unknown> {
    return { name: calendarDetailText(row.title, 100) ?? '', scheduled_start_time: new Date(row.plannedAt).toISOString(),
        scheduled_end_time: new Date(row.endAt !== null && row.endAt > row.plannedAt ? row.endAt : row.plannedAt + 3_600_000).toISOString(),
        privacy_level: 2, entity_type: 3, channel_id: null, entity_metadata: { location: calendarDetailText(row.location, 100) ?? apiText(locale, 'calendarPublicLocation') },
        description: discordText(row.description, 1000) ?? apiText(locale, 'calendarPublicEventDescription') };
}
