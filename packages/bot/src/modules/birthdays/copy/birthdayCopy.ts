import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import type { SupportedOutputLocale } from '../../../core/localization.js';

export interface BirthdayCopy {
    notSet: (subject: string) => string;
    birthday: (subject: string, date: string) => string;
    removed: (subject: string) => string;
    invalidDate: string;
    alreadySet: (subject: string) => string;
    reminderSet: (subject: string) => string;
    unknownSubcommand: string;
    noneUpcoming: (days: number) => string;
    upcoming: (days: number) => string;
    serverOnly: string;
    your: string;
    you: string;
}

const copies: Record<SupportedOutputLocale, BirthdayCopy> = {
    en: {
        notSet: subject => `${subject} ${subject === 'You' ? 'do' : 'does'} not have a birthday set in this server.`, birthday: (subject, date) => `${subject} birthday: ${date}`,
        removed: subject => `${subject} birthday has been removed.`, invalidDate: 'Invalid day or month.',
        alreadySet: subject => `${subject} already have a birthday set in this server.`, reminderSet: subject => `${subject} birthday reminder is set!`,
        unknownSubcommand: 'Unknown birthdays subcommand.', noneUpcoming: days => `No birthdays in the next ${days} days.`,
        upcoming: days => `Upcoming birthdays in the next ${days} days:`, serverOnly: 'Birthday lookup only works in a server.',
        your: 'Your', you: 'You',
    },
    nl: {
        notSet: subject => `${subject} ${subject === 'Je' ? 'hebt' : 'heeft'} geen verjaardag ingesteld op deze server.`, birthday: (subject, date) => `${subject} verjaardag: ${date}`,
        removed: subject => subject.startsWith('<@') ? `De verjaardag van ${subject} is verwijderd.` : `${subject} verjaardag is verwijderd.`, invalidDate: 'Ongeldige dag of maand.',
        alreadySet: subject => subject === 'Je' ? 'Je hebt al een verjaardag ingesteld op deze server.' : `${subject} heeft al een verjaardag ingesteld op deze server.`, reminderSet: subject => subject.startsWith('<@') ? `De verjaardagsmelding voor ${subject} is ingesteld.` : `${subject} verjaardagsmelding is ingesteld.`,
        unknownSubcommand: 'Onbekende verjaardagopdracht.', noneUpcoming: days => `Geen verjaardagen in de komende ${days} dagen.`,
        upcoming: days => `Komende verjaardagen in de komende ${days} dagen:`, serverOnly: 'Verjaardagen opzoeken werkt alleen op een server.',
        your: 'Jouw', you: 'Je',
    },
};

export function getBirthdayCopy(locale: SupportedOutputLocale): BirthdayCopy {
    return copies[locale];
}

export function formatBirthdayMonth(month: number, locale: SupportedOutputLocale): string {
    return new Intl.DateTimeFormat(resolveLocaleValue(locale, { en: 'en-GB', nl: 'nl-NL' }), { month: 'long' })
        .format(new Date(2000, month - 1, 1));
}
