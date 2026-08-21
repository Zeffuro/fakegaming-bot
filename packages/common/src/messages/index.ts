import { createTranslator } from 'use-intl/core';
import type { AbstractIntlMessages } from 'use-intl';
import animeEn from './en/anime.json' with { type: 'json' };
import cardsEn from './en/cards.json' with { type: 'json' };
import sharedEn from './en/shared.json' with { type: 'json' };
import animeNl from './nl/anime.json' with { type: 'json' };
import cardsNl from './nl/cards.json' with { type: 'json' };
import sharedNl from './nl/shared.json' with { type: 'json' };
import {
    getOutputLocaleMetadata,
    type OutputLocaleValues,
    type SupportedOutputLocale,
} from '../utils/outputLocale.js';

const englishMessages = {
    anime: animeEn,
    cards: cardsEn,
    shared: sharedEn,
} satisfies AbstractIntlMessages;

type CommonMessages = typeof englishMessages;

const commonMessages = {
    en: englishMessages,
    nl: {
        anime: animeNl,
        cards: cardsNl,
        shared: sharedNl,
    },
} satisfies OutputLocaleValues<CommonMessages>;

export function getCommonMessages(locale: SupportedOutputLocale): CommonMessages {
    return commonMessages[locale];
}

function buildCommonTranslator(locale: SupportedOutputLocale) {
    return createTranslator({
        locale: getOutputLocaleMetadata(locale).formatTag,
        messages: getCommonMessages(locale),
    });
}

const commonTranslators = new Map<SupportedOutputLocale, ReturnType<typeof buildCommonTranslator>>();

export function createCommonTranslator(locale: SupportedOutputLocale): ReturnType<typeof buildCommonTranslator> {
    const existing = commonTranslators.get(locale);
    if (existing) return existing;
    const translator = buildCommonTranslator(locale);
    commonTranslators.set(locale, translator);
    return translator;
}
