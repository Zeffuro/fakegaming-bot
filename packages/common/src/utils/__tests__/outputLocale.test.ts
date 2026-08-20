import { describe, expect, it } from 'vitest';
import {
    getOutputLocaleMetadata,
    isSupportedOutputLocale,
    NON_DEFAULT_OUTPUT_LOCALES,
    resolveOutputLocaleFromAcceptLanguage,
    type NonDefaultOutputLocale,
    resolveLocaleValue,
    type OutputLocaleValues,
} from '../outputLocale.js';

describe('output locale registry', () => {
    it('resolves complete locale-keyed values', () => {
        const values = {
            en: 'Save',
            nl: 'Opslaan',
        } satisfies OutputLocaleValues<string>;

        expect(resolveLocaleValue('en', values)).toBe('Save');
        expect(resolveLocaleValue('nl', values)).toBe('Opslaan');
    });

    it('keeps locale metadata in the shared registry', () => {
        const translatedLocale: NonDefaultOutputLocale = 'nl';

        expect(getOutputLocaleMetadata('en')).toMatchObject({ languageTag: 'en-US', htmlLang: 'en' });
        expect(getOutputLocaleMetadata(translatedLocale)).toMatchObject({ languageTag: 'nl-NL', htmlLang: 'nl' });
        expect(isSupportedOutputLocale('nl')).toBe(true);
        expect(isSupportedOutputLocale('fr')).toBe(false);
        expect(NON_DEFAULT_OUTPUT_LOCALES).toEqual(['nl']);
    });

    it('negotiates regional Accept-Language tags by quality', () => {
        expect(resolveOutputLocaleFromAcceptLanguage('nl-NL,nl;q=0.9,en;q=0.8')).toBe('nl');
        expect(resolveOutputLocaleFromAcceptLanguage('nl;q=0.3,en-GB;q=0.9')).toBe('en');
        expect(resolveOutputLocaleFromAcceptLanguage(['fr-FR', 'nl;q=0.8'])).toBe('nl');
        expect(resolveOutputLocaleFromAcceptLanguage('nl;q=0,*;q=0.5')).toBe('en');
        expect(resolveOutputLocaleFromAcceptLanguage(undefined)).toBe('en');
    });
});
