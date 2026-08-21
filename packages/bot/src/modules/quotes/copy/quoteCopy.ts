import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import englishMessages from '../../../messages/en/quotes.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/quotes.json' with { type: 'json' };

export type QuoteCopyKey = keyof typeof englishMessages;

export function quoteText(locale: SupportedOutputLocale, key: QuoteCopyKey): string {
    const messages = resolveLocaleValue(locale, { en: englishMessages, nl: dutchMessages } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    return createBotTranslator(locale, messages)(key);
}
