import { describe, expect, it } from 'vitest';
import {
    DEFAULT_OUTPUT_LOCALE,
    formatTranslation,
    resolveInteractionOutputLocale,
    resolveOutputLocale,
    translate,
    type LocaleCatalog,
} from '../localization.js';

const CATALOG = {
    greeting: { en: 'Hello', nl: 'Hallo' },
    englishOnly: { en: 'English only', nl: 'English only' },
} as const satisfies LocaleCatalog<'greeting' | 'englishOnly'>;

describe('output locale resolution', () => {
    it('accepts supported stored guild locales and falls back to English', () => {
        expect(resolveOutputLocale('nl')).toBe('nl');
        expect(resolveOutputLocale('en')).toBe('en');
        expect(resolveOutputLocale()).toBe(DEFAULT_OUTPUT_LOCALE);
        expect(resolveOutputLocale('fr')).toBe(DEFAULT_OUTPUT_LOCALE);
        expect(resolveOutputLocale({ locale: 'nl' })).toBe(DEFAULT_OUTPUT_LOCALE);
    });

    it('uses stored guild locale before Discord locale and uses user locale in DMs', async () => {
        await expect(resolveInteractionOutputLocale(
            { guildId: 'guild', locale: 'nl' },
            async () => 'en',
        )).resolves.toBe('en');
        await expect(resolveInteractionOutputLocale(
            { guildId: null, locale: 'nl', user: { id: 'user' } },
            async () => 'en',
            async () => null,
        )).resolves.toBe('nl');
    });

    it('prefers a stored user locale in direct messages', async () => {
        await expect(resolveInteractionOutputLocale(
            { guildId: null, locale: 'en', user: { id: 'user' } },
            async () => 'en',
            async () => 'nl',
        )).resolves.toBe('nl');
    });

    it('falls back to English when guild locale loading fails', async () => {
        await expect(resolveInteractionOutputLocale(
            { guildId: 'guild', locale: 'nl' },
            async () => { throw new Error('unavailable'); },
        )).resolves.toBe('en');
    });
});

describe('translation catalog', () => {
    it('uses the requested locale from a complete catalog', () => {
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
