import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import englishMessages from '../../../messages/en/league.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/league.json' with { type: 'json' };

export type LeagueCopyKey = keyof typeof englishMessages;

export function leagueText(locale: SupportedOutputLocale, key: LeagueCopyKey): string {
    const messages = resolveLocaleValue(locale, { en: englishMessages, nl: dutchMessages } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    return createBotTranslator(locale, messages)(key);
}

export function unknownError(locale: SupportedOutputLocale): string {
    return leagueText(locale, 'unknownError');
}

export function missingIdentity(locale: SupportedOutputLocale): string {
    return leagueText(locale, 'pleaseProvideARiotIdAndRegionOr');
}
