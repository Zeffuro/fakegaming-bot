import { describe, expect, it } from 'vitest';
import { getBirthdayCopy } from '../../modules/birthdays/copy/birthdayCopy.js';
import { getGeneralCopy } from '../../modules/general/data/generalCopy.js';
import { getNotesCopy } from '../../modules/notes/copy/notesCopy.js';
import { getReminderCopy } from '../../modules/reminders/copy/reminderCopy.js';

describe('localized copy grammar', () => {
    it('formats English and Dutch birthday subjects', () => {
        const english = getBirthdayCopy('en');
        const dutch = getBirthdayCopy('nl');

        expect(english.notSet('You')).toContain('You do not');
        expect(english.notSet('<@1>')).toContain('<@1> does not');
        expect(dutch.notSet('Je')).toContain('Je hebt geen');
        expect(dutch.notSet('<@1>')).toContain('<@1> heeft geen');
        expect(dutch.removed('<@1>')).toBe('De verjaardag van <@1> is verwijderd.');
        expect(dutch.removed('Jouw')).toBe('Jouw verjaardag is verwijderd.');
        expect(dutch.alreadySet('Je')).toBe('Je hebt al een verjaardag ingesteld op deze server.');
        expect(dutch.alreadySet('<@1>')).toContain('<@1> heeft al');
        expect(dutch.reminderSet('<@1>')).toBe('De verjaardagsmelding voor <@1> is ingesteld.');
        expect(dutch.reminderSet('Jouw')).toBe('Jouw verjaardagsmelding is ingesteld.');
    });

    it('pluralizes reminder recurrence units in both locales', () => {
        const english = getReminderCopy('en');
        const dutch = getReminderCopy('nl');

        expect(english.repeat(1, 'day', 'Europe/Amsterdam')).toContain('every day');
        expect(english.repeat(2, 'day', 'Europe/Amsterdam')).toContain('every 2 days');
        expect(dutch.repeat(1, 'week', 'Europe/Amsterdam')).toContain('elke week');
        expect(dutch.repeat(2, 'month', 'Europe/Amsterdam')).toContain('elke 2 maanden');
    });

    it('pluralizes saved-message attachment and sticker summaries', () => {
        const english = getNotesCopy('en');
        const dutch = getNotesCopy('nl');

        expect(english.attachments(1)).toBe('1 attachment');
        expect(english.attachments(2)).toBe('2 attachments');
        expect(english.stickers(1)).toBe('1 sticker');
        expect(english.stickers(2)).toBe('2 stickers');
        expect(dutch.attachments(1)).toBe('1 bijlage');
        expect(dutch.attachments(2)).toBe('2 bijlagen');
        expect(dutch.stickers(1)).toBe('1 sticker');
        expect(dutch.stickers(2)).toBe('2 stickers');
    });

    it('formats permission member sources and poll vote grammar', () => {
        const english = getGeneralCopy('en');
        const dutch = getGeneralCopy('nl');

        expect(dutch.permissions.summary(2, 'fetched', 3, 4)).toContain('opgehaalde leden');
        expect(dutch.permissions.summary(2, 'cached', 3, 4)).toContain('gecachete leden');
        expect(english.poll.votes(1)).toBe('1 vote');
        expect(english.poll.votes(2)).toBe('2 votes');
        expect(dutch.poll.votes(1)).toBe('1 stem');
        expect(dutch.poll.votes(2)).toBe('2 stemmen');
        expect(english.poll.winner('A', 1)).toContain('1 vote');
        expect(english.poll.winner('A', 2)).toContain('2 votes');
        expect(dutch.poll.tie('A, B', 1)).toContain('1 stem');
        expect(dutch.poll.tie('A, B', 2)).toContain('2 stemmen');
    });
});
