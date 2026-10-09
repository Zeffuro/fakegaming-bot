import { describe, expect, it } from 'vitest';
import { apiText } from '../localization/locale.js';
import { publicationDuration, publicationEvent, publicationMessage, publicationMessageDetails } from './payload.js';

const row = { id: 'id', title: 'Appointment', plannedAt: Date.UTC(2026, 9, 20), endAt: Date.UTC(2026, 9, 20, 1), timezone: 'UTC', allDay: false, cancelled: false };
describe('calendar publication payloads', () => {
    it('omits absent fields and links, including duration when the provider has no valid end', () => {
        const empty = { ...row, endAt: null, location: ' ', description: ' ', htmlLink: 'https://evil.test' };
        const message = publicationMessage(empty, 'en', 0);
        const embed = (message.embeds as Array<{ url?: string; fields: Array<{ name: string; value: string }> }>)[0];
        expect(embed.url).toBeUndefined(); expect(embed.fields).toHaveLength(1);
        expect(embed.fields.every(field => field.value.trim())).toBe(true);
        expect(publicationDuration(empty, 'en')).toBeNull();
        expect(publicationDuration({ ...row, endAt: row.plannedAt }, 'en')).toBeNull();
        expect(publicationEvent(empty, 'en')).toMatchObject({ entity_metadata: { location: apiText('en', 'calendarPublicLocation') }, description: apiText('en', 'calendarPublicEventDescription') });
    });
    it.each(['en', 'nl'] as const)('includes localized provider duration in %s', locale => {
        const duration = publicationDuration({ ...row, endAt: row.plannedAt + (2 * 1440 + 3 * 60 + 4) * 60_000 }, locale);
        expect(duration).toBe([apiText(locale, 'calendarPublicDurationDays', { count: 2 }), apiText(locale, 'calendarPublicDurationHours', { count: 3 }), apiText(locale, 'calendarPublicDurationMinutes', { count: 4 })].join(' '));
        expect(publicationDuration({ ...row, endAt: row.plannedAt + 1 }, locale)).toBe(apiText(locale, 'calendarPublicDurationMinutes', { count: 1 }));
    });
    it('uses exact bounded safe preview fields and suppresses mentions for channel and Event content', () => {
        const rich = { ...row, title: '@everyone [appointment]', htmlLink: 'https://www.google.com/calendar/event?eid=synthetic', location: '@everyone Clinic', description: '*'.repeat(1000) };
        const preview = publicationMessageDetails(rich, 'en');
        const message = publicationMessage(rich, 'en', 0);
        const embed = (message.embeds as Array<{ title: string; url: string; fields: Array<{ name: string; value: string }> }>)[0];
        expect(embed.title).toBe(preview.title); expect(embed.url).toBe(preview.url);
        for (const [key, label] of [['duration', 'calendarPublicDuration'], ['location', 'calendarPublicLocationLabel'], ['description', 'calendarPublicDescription']] as const) {
            expect(embed.fields.find(field => field.name === apiText('en', label))?.value).toBe(preview[key]);
        }
        expect(preview.description).toHaveLength(1000); expect(embed.fields.every(field => field.value.length <= 1024)).toBe(true);
        expect(message.allowed_mentions).toEqual({ parse: [] }); expect(JSON.stringify(message)).not.toContain('@everyone');
        const event = publicationEvent(rich, 'en');
        expect(event.entity_metadata).toEqual({ location: '@\u200beveryone Clinic' }); expect(event.description).toBe(preview.description);
        expect(event.name).not.toContain('@everyone');
    });
});
