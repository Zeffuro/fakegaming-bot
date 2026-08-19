import {
    DEFAULT_OUTPUT_LOCALE,
    isSupportedOutputLocale,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';

export {
    SUPPORTED_OUTPUT_LOCALES,
    DEFAULT_OUTPUT_LOCALE,
    isSupportedOutputLocale,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';

export type LocaleCatalog<Key extends string> = Readonly<Record<Key, Readonly<Partial<Record<SupportedOutputLocale, string>>>>>;

export type CompleteLocaleCatalog<Key extends string> = Readonly<Record<
    Key,
    Readonly<{ en: string } & Partial<Record<SupportedOutputLocale, string>>>
>>;

export function createLocaleCatalog<Key extends string>(catalog: CompleteLocaleCatalog<Key>): LocaleCatalog<Key> {
    return Object.freeze(catalog);
}

/**
 * Accepts a persisted guild preference without coupling command code to its
 * storage. Unknown and absent values deliberately use English.
 */
export function resolveOutputLocale(preferredGuildLocale?: unknown): SupportedOutputLocale {
    return isSupportedOutputLocale(preferredGuildLocale) ? preferredGuildLocale : DEFAULT_OUTPUT_LOCALE;
}

/**
 * Resolves locale-specific application copy. A missing secondary translation
 * falls back to English; a missing catalog key is returned unchanged so callers
 * can surface and diagnose it without failing an interaction.
 */
export function translate<Key extends string>(
    catalog: LocaleCatalog<Key>,
    locale: SupportedOutputLocale,
    key: string,
): string {
    const entry = catalog[key as Key];
    if (!entry) return key;

    return entry[locale] ?? entry[DEFAULT_OUTPUT_LOCALE] ?? key;
}

export function formatTranslation(template: string, values: Readonly<Record<string, string>>): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}
