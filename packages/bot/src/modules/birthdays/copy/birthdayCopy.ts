import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import {
    createBotTranslator,
    getOutputLocaleMetadata,
    type BotMessages,
    type SupportedOutputLocale,
} from '../../../core/localization.js';
import englishMessages from '../../../messages/en/birthday.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/birthday.json' with { type: 'json' };

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

export function getBirthdayCopy(locale: SupportedOutputLocale): BirthdayCopy {
    const messages = resolveLocaleValue(locale, {
        en: englishMessages,
        nl: dutchMessages,
    } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    const t = createBotTranslator(locale, messages);
    const raw = messages;
    return {
        invalidDate: raw.invalidDate,
        unknownSubcommand: raw.unknownSubcommand,
        serverOnly: raw.serverOnly,
        your: raw.your,
        you: raw.you,
        notSet: subject => t('notSet', { subject, kind: subject === raw.you ? 'self' : 'other' }),
        birthday: (subject, date) => t('birthday', { subject, date }),
        removed: subject => t('removed', { subject, kind: subject.startsWith('<@') ? 'mention' : 'other' }),
        alreadySet: subject => t('alreadySet', { subject, kind: subject === raw.you ? 'self' : 'other' }),
        reminderSet: subject => t('reminderSet', { subject, kind: subject.startsWith('<@') ? 'mention' : 'other' }),
        noneUpcoming: days => t('noneUpcoming', { days }),
        upcoming: days => t('upcoming', { days }),
    };
}

export function formatBirthdayMonth(month: number, locale: SupportedOutputLocale): string {
    return new Intl.DateTimeFormat(getOutputLocaleMetadata(locale).formatTag, { month: 'long' })
        .format(new Date(2000, month - 1, 1));
}
