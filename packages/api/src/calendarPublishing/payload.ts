import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { apiText } from '../localization/locale.js';
import type { PublicOccurrence } from './configuration.js';

const escapeTitle = (value: string) => value.replace(/[\\`*_{}\[\]()<>#|]/g, '\\$&');
export function publicationMessage(row: PublicOccurrence, locale: SupportedOutputLocale, now: number): Record<string, unknown> {
    const seconds = Math.floor(row.plannedAt / 1000);
    const status = row.cancelled ? 'calendarPublicCancelled' : row.plannedAt <= now ? 'calendarPublicPast' : 'calendarPublicUpcoming';
    const fields = [{ name: apiText(locale, 'calendarPublicWhen'), value: `<t:${seconds}:F>\n<t:${seconds}:R>`, inline: false }];
    if (row.endAt !== null && row.endAt > row.plannedAt) fields.push({ name: apiText(locale, 'calendarPublicEnd'), value: `<t:${Math.floor(row.endAt / 1000)}:F>`, inline: false });
    if (row.allDay) fields.push({ name: apiText(locale, 'calendarPublicType'), value: apiText(locale, 'calendarPublicAllDay'), inline: false });
    return { content: '', allowed_mentions: { parse: [] }, components: [], embeds: [{ title: escapeTitle(row.title).slice(0, 256),
        description: apiText(locale, status), color: row.cancelled ? 0xE05A61 : 0x28B6D4, fields,
        footer: { text: apiText(locale, 'calendarPublicTimezone', { timezone: row.timezone }) } }] };
}

export function publicationEvent(row: PublicOccurrence, locale: SupportedOutputLocale): Record<string, unknown> {
    return { name: row.title.slice(0, 100), scheduled_start_time: new Date(row.plannedAt).toISOString(),
        scheduled_end_time: new Date(row.endAt !== null && row.endAt > row.plannedAt ? row.endAt : row.plannedAt + 3_600_000).toISOString(),
        privacy_level: 2, entity_type: 3, channel_id: null, entity_metadata: { location: apiText(locale, 'calendarPublicLocation') },
        description: apiText(locale, 'calendarPublicEventDescription') };
}
