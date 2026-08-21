import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import englishMessages from '../../../messages/en/anime.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/anime.json' with { type: 'json' };

export type AnimeCopy = { readonly [Key in keyof typeof englishMessages]: string };

export function getAnimeCopy(locale: SupportedOutputLocale): AnimeCopy {
    const messages = resolveLocaleValue(locale, {
        en: englishMessages,
        nl: dutchMessages,
    } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    const translate = createBotTranslator(locale, messages);
    return Object.fromEntries((Object.keys(englishMessages) as Array<keyof typeof englishMessages>)
        .map(key => [key, translate(key)])) as AnimeCopy;
}
