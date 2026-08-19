import { describe, expect, it } from 'vitest';
import {
    DEFAULT_OUTPUT_LOCALE,
    formatTranslation,
    resolveOutputLocale,
    translate,
    type LocaleCatalog,
} from '../localization.js';

const CATALOG = {
    greeting: { en: 'Hello', nl: 'Hallo' },
    englishOnly: { en: 'English only' },
} as const satisfies LocaleCatalog<'greeting' | 'englishOnly'>;

describe('output locale resolution', () => {
    it('accepts supported stored guild locales and falls back to English', () => {
        expect(resolveOutputLocale('nl')).toBe('nl');
        expect(resolveOutputLocale('en')).toBe('en');
        expect(resolveOutputLocale()).toBe(DEFAULT_OUTPUT_LOCALE);
        expect(resolveOutputLocale('fr')).toBe(DEFAULT_OUTPUT_LOCALE);
        expect(resolveOutputLocale({ locale: 'nl' })).toBe(DEFAULT_OUTPUT_LOCALE);
    });
});

describe('translation catalog', () => {
    it('uses the requested locale, then English when a secondary translation is absent', () => {
        expect(translate(CATALOG, 'nl', 'greeting')).toBe('Hallo');
        expect(translate(CATALOG, 'nl', 'englishOnly')).toBe('English only');
    });

    it('returns a missing key unchanged without throwing', () => {
        expect(translate(CATALOG, 'en', 'missing.key')).toBe('missing.key');
    });

    it('formats only supplied placeholder values and leaves unknown placeholders visible', () => {
        expect(formatTranslation('Category: {category}; {missing}', { category: 'Gaming' }))
            .toBe('Category: Gaming; {missing}');
    });
});
