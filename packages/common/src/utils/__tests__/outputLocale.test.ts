import { describe, expect, it } from 'vitest';
import {
    getLocaleMetadata,
    isSupportedLocale,
    NON_DEFAULT_LOCALES,
    resolveLocaleFromAcceptLanguage,
    type NonDefaultLocale,
    resolveLocaleValue,
    type LocaleValues,
} from '../outputLocale.js';

describe('output locale registry', () => {
    it('resolves complete locale-keyed values', () => {
        const values = {
            en: 'Save',
            nl: 'Opslaan',
        } satisfies LocaleValues<string>;

        expect(resolveLocaleValue('en', values)).toBe('Save');
        expect(resolveLocaleValue('nl', values)).toBe('Opslaan');
    });

    it('keeps locale metadata in the shared registry', () => {
        const translatedLocale: NonDefaultLocale = 'nl';

        expect(getLocaleMetadata('en')).toMatchObject({ formatTag: 'en-US', htmlLang: 'en' });
        expect(getLocaleMetadata(translatedLocale)).toMatchObject({ formatTag: 'nl-NL', htmlLang: 'nl' });
        expect(isSupportedLocale('nl')).toBe(true);
        expect(isSupportedLocale('fr')).toBe(false);
        expect(NON_DEFAULT_LOCALES).toEqual(['nl']);
    });

    it('negotiates regional Accept-Language tags by quality', () => {
        expect(resolveLocaleFromAcceptLanguage('nl-NL,nl;q=0.9,en;q=0.8')).toBe('nl');
        expect(resolveLocaleFromAcceptLanguage('nl;q=0.3,en-GB;q=0.9')).toBe('en');
        expect(resolveLocaleFromAcceptLanguage(['fr-FR', 'nl;q=0.8'])).toBe('nl');
        expect(resolveLocaleFromAcceptLanguage('nl;q=0,*;q=0.5')).toBe('en');
        expect(resolveLocaleFromAcceptLanguage(undefined)).toBe('en');
    });
});
