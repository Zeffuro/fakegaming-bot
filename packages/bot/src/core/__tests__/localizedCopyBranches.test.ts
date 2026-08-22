import { describe, expect, it } from 'vitest';
import { getBirthdayCopy } from '../../modules/birthdays/copy/birthdayCopy.js';
import { getGeneralCopy } from '../../modules/general/data/generalCopy.js';
import { getNotesCopy } from '../../modules/notes/copy/notesCopy.js';
import { getReminderCopy } from '../../modules/reminders/copy/reminderCopy.js';
import type { SupportedOutputLocale } from '../localization.js';

const locales = ['en', 'nl'] satisfies SupportedOutputLocale[];

function expectRendered(message: string, ...values: string[]): void {
    expect(message.trim()).not.toBe('');
    for (const value of values) expect(message).toContain(value);
}

describe('localized copy grammar', () => {
    it.each(locales)('interpolates birthday subjects in %s', locale => {
        const copy = getBirthdayCopy(locale);

        expectRendered(copy.notSet(copy.you), copy.you);
        expectRendered(copy.notSet('<@1>'), '<@1>');
        expectRendered(copy.removed('<@1>'), '<@1>');
        expectRendered(copy.removed(copy.your), copy.your);
        expectRendered(copy.alreadySet(copy.you), copy.you);
        expectRendered(copy.alreadySet('<@1>'), '<@1>');
        expectRendered(copy.reminderSet('<@1>'), '<@1>');
        expectRendered(copy.reminderSet(copy.your), copy.your);
    });

    it.each(locales)('renders reminder recurrence branches in %s', locale => {
        const copy = getReminderCopy(locale);
        const singular = copy.repeat(1, 'week', 'Europe/Amsterdam');
        const plural = copy.repeat(2, 'month', 'Europe/Amsterdam');

        expectRendered(singular, 'Europe/Amsterdam');
        expectRendered(plural, 'Europe/Amsterdam');
        expect(singular).not.toBe(plural);
    });

    it.each(locales)('renders saved-message attachment and sticker counts in %s', locale => {
        const copy = getNotesCopy(locale);

        expectRendered(copy.attachments(1), '1');
        expectRendered(copy.attachments(2), '2');
        expectRendered(copy.stickers(1), '1');
        expectRendered(copy.stickers(2), '2');
        expect(copy.attachments(1)).not.toBe(copy.attachments(2));
        expect(copy.stickers(1)).not.toBe(copy.stickers(2));
    });

    it.each(locales)('renders permission and poll branches in %s', locale => {
        const copy = getGeneralCopy(locale);
        const fetched = copy.permissions.summary(2, 'fetched', 3, 4);
        const cached = copy.permissions.summary(2, 'cached', 3, 4);

        expectRendered(fetched, '2', '3', '4');
        expectRendered(cached, '2', '3', '4');
        expect(fetched).not.toBe(cached);
        expectRendered(copy.poll.votes(1), '1');
        expectRendered(copy.poll.votes(2), '2');
        expectRendered(copy.poll.winner('Option A', 1), 'Option A', '1');
        expectRendered(copy.poll.winner('Option A', 2), 'Option A', '2');
        expectRendered(copy.poll.tie('Option A, Option B', 1), 'Option A, Option B', '1');
        expectRendered(copy.poll.tie('Option A, Option B', 2), 'Option A, Option B', '2');
    });
});
