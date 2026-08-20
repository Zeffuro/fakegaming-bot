import { describe, expect, it } from 'vitest';
import { encodeComponentLocale, parseComponentLocale } from '../componentLocale.js';

describe('component locale encoding', () => {
    it('keeps English component IDs compatible and suffixes other locales', () => {
        expect(encodeComponentLocale('en')).toBe('');
        expect(encodeComponentLocale('nl')).toBe(':nl');
    });

    it('accepts supported locale suffixes and rejects absent or unknown values', () => {
        expect(parseComponentLocale('en')).toBe('en');
        expect(parseComponentLocale('nl')).toBe('nl');
        expect(parseComponentLocale(undefined)).toBeNull();
        expect(parseComponentLocale('fr')).toBeNull();
    });
});
