import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OUTPUT_LOCALE, NON_DEFAULT_OUTPUT_LOCALES } from '@zeffuro/fakegaming-common';

const mocks = vi.hoisted(() => ({
    getGuildOutputLocale: vi.fn(),
    getPreferredLocale: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        guildLocaleConfigManager: { getOutputLocale: mocks.getGuildOutputLocale },
        userManager: { getPreferredLocale: mocks.getPreferredLocale },
    }),
}));
import { API_COPY, API_COPY_EN, API_MESSAGE_DOMAINS, API_TEMPLATE_COPY, type ApiCopyKey } from '../catalog.js';
import { apiText, createApiTranslator, resolveApiLocale, resolveGuildOutputLocale, resolveUserOutputLocale } from '../locale.js';

describe('API localization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getGuildOutputLocale.mockResolvedValue('nl');
        mocks.getPreferredLocale.mockResolvedValue('nl');
    });

    it('keeps every translated catalog in exact key parity with the default', () => {
        const shape = (value: unknown): unknown => {
            if (typeof value !== 'object' || value === null) return typeof value;
            return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, shape(nestedValue)]));
        };

        expect(Object.keys(API_MESSAGE_DOMAINS.nl).sort()).toEqual(Object.keys(API_MESSAGE_DOMAINS.en).sort());
        expect(shape(API_TEMPLATE_COPY.nl)).toEqual(shape(API_TEMPLATE_COPY.en));
        for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
            expect(Object.keys(API_COPY[locale]).sort(), locale).toEqual(Object.keys(API_COPY_EN).sort());
            for (const domain of Object.keys(API_MESSAGE_DOMAINS.en) as Array<keyof typeof API_MESSAGE_DOMAINS.en>) {
                expect(Object.keys(API_MESSAGE_DOMAINS[locale][domain]).sort(), `${locale}:${domain}`)
                    .toEqual(Object.keys(API_MESSAGE_DOMAINS.en[domain]).sort());
            }
        }
    });

    it('keeps interpolation placeholders in parity for every catalog entry', () => {
        const placeholders = (copy: string): string[] =>
            [...copy.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
                .map(match => match[1] ?? '')
                .sort();

        const defaultCopy = API_COPY[DEFAULT_OUTPUT_LOCALE];
        for (const locale of NON_DEFAULT_OUTPUT_LOCALES) {
            for (const key of Object.keys(defaultCopy) as Array<keyof typeof defaultCopy>) {
                expect(placeholders(API_COPY[locale][key]), `${locale}:${key}`).toEqual(placeholders(defaultCopy[key]));
            }
        }
    });

    it('negotiates regional tags and quality values with English fallback', () => {
        expect(resolveApiLocale('nl-NL,nl;q=0.9,en;q=0.8')).toBe('nl');
        expect(resolveApiLocale('nl;q=0.3,en-GB;q=0.9')).toBe('en');
        expect(resolveApiLocale('fr-FR')).toBe('en');
        expect(resolveApiLocale(undefined)).toBe('en');
    });

    it('formats localized values without changing inserted content', () => {
        expect(apiText('nl', 'reminder', { message: 'Play Final Fantasy XIV', elapsed: '2 uur geleden' }))
            .toContain('Play Final Fantasy XIV');
        expect(apiText('en', 'animeDescription', { episode: 3, airingAt: 1_700_000_000 }))
            .toBe('Episode 3 airs <t:1700000000:R>.');
        expect(apiText('nl', 'animeDescription', { episode: 3, airingAt: 1_700_000_000 }))
            .toBe('Aflevering 3 wordt <t:1700000000:R> uitgezonden.');
    });

    it('formats every localized ICU message with the same arguments as English', () => {
        const placeholders = (copy: string): string[] =>
            [...copy.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
                .map(match => match[1] ?? '')
                .sort();

        for (const locale of [DEFAULT_OUTPUT_LOCALE, ...NON_DEFAULT_OUTPUT_LOCALES]) {
            const translate = createApiTranslator(locale);
            for (const key of Object.keys(API_COPY_EN) as ApiCopyKey[]) {
                const names = placeholders(API_COPY_EN[key]);
                expect(placeholders(API_COPY[locale][key]), `${locale}:${key}`).toEqual(names);
                expect(() => translate(key, Object.fromEntries(names.map(name => [name, name])))).not.toThrow();
            }
        }
    });

    it('resolves stored output locales', async () => {
        await expect(resolveGuildOutputLocale('guild-1')).resolves.toBe('nl');
        await expect(resolveUserOutputLocale('user-1')).resolves.toBe('nl');
    });

    it('falls back to English when locale storage is unavailable', async () => {
        mocks.getGuildOutputLocale.mockRejectedValue(new Error('database unavailable'));
        mocks.getPreferredLocale.mockRejectedValue(new Error('database unavailable'));

        await expect(resolveGuildOutputLocale('guild-1')).resolves.toBe('en');
        await expect(resolveUserOutputLocale('user-1')).resolves.toBe('en');
    });
});
