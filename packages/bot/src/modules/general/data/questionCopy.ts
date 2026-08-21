import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type BotTranslationValues, type SupportedOutputLocale } from '../../../core/localization.js';
import type { QuestionCategorySelection } from '../shared/questionDeck.js';
import englishMessages from '../../../messages/en/question.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/question.json' with { type: 'json' };

export type QuestionCopyKey =
    | 'title' | 'anotherQuestion' | 'categoryUnavailable' | 'questionsUnavailable' | 'buttonUnavailable'
    | 'categoryFooter' | `category.${QuestionCategorySelection}`;

export function translateQuestion(
    locale: SupportedOutputLocale,
    key: QuestionCopyKey,
    values?: BotTranslationValues,
): string {
    const messages = resolveLocaleValue(locale, { en: englishMessages, nl: dutchMessages } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    return createBotTranslator(locale, messages)(key, values);
}

export function questionCategoryCopyKey(category: QuestionCategorySelection): QuestionCopyKey {
    return `category.${category}`;
}
