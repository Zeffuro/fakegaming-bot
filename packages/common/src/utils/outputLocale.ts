// Persist product locale keys; regional formatting belongs in locale metadata.
export const SUPPORTED_LOCALES = ['en', 'nl'] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE = 'en' as const satisfies SupportedLocale;

// Compatibility aliases for the existing guild/user output-locale contract.
export const SUPPORTED_OUTPUT_LOCALES = SUPPORTED_LOCALES;
export type SupportedOutputLocale = SupportedLocale;
export const DEFAULT_OUTPUT_LOCALE = DEFAULT_LOCALE;

export type NonDefaultLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>;

export const NON_DEFAULT_LOCALES: readonly NonDefaultLocale[] = Object.freeze(
    SUPPORTED_LOCALES.filter(
        (locale): locale is NonDefaultLocale => locale !== DEFAULT_LOCALE,
    ),
);

export type NonDefaultOutputLocale = NonDefaultLocale;
export const NON_DEFAULT_OUTPUT_LOCALES = NON_DEFAULT_LOCALES;

export type LocaleValues<T> = Readonly<Record<SupportedLocale, T>>;
export type OutputLocaleValues<T> = LocaleValues<T>;

export interface LocaleMetadata {
    formatTag: string;
    /** @deprecated Use formatTag for Intl formatting. */
    languageTag: string;
    htmlLang: string;
    nativeName: string;
}

export type OutputLocaleMetadata = LocaleMetadata;

export const LOCALE_METADATA = {
    en: {
        formatTag: 'en-US',
        languageTag: 'en-US',
        htmlLang: 'en',
        nativeName: 'English',
    },
    nl: {
        formatTag: 'nl-NL',
        languageTag: 'nl-NL',
        htmlLang: 'nl',
        nativeName: 'Nederlands',
    },
} as const satisfies LocaleValues<LocaleMetadata>;

export const OUTPUT_LOCALE_METADATA = LOCALE_METADATA;

export function isSupportedLocale(value: unknown): value is SupportedLocale {
    return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const isSupportedOutputLocale = isSupportedLocale;

export function resolveLocaleFromAcceptLanguage(
    value: string | readonly string[] | null | undefined,
): SupportedLocale {
    if (!value) return DEFAULT_LOCALE;
    const header = typeof value === 'string' ? value : value.join(',');

    const preferences = header.split(',')
        .map((part, index) => {
            const [rawTag, ...parameters] = part.trim().split(';');
            const qualityParameter = parameters.find(parameter => parameter.trim().startsWith('q='));
            const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;

            return {
                tag: rawTag?.toLowerCase() ?? '',
                quality: Number.isFinite(quality) ? quality : 0,
                index,
            };
        })
        .filter(preference => preference.quality > 0)
        .sort((left, right) => right.quality - left.quality || left.index - right.index);

    for (const preference of preferences) {
        const primary = preference.tag.split('-')[0];
        if (isSupportedLocale(primary)) return primary;
        if (preference.tag === '*') return DEFAULT_LOCALE;
    }

    return DEFAULT_LOCALE;
}

export const resolveOutputLocaleFromAcceptLanguage = resolveLocaleFromAcceptLanguage;

export function getLocaleMetadata(locale: SupportedLocale): LocaleMetadata {
    return LOCALE_METADATA[locale];
}

export const getOutputLocaleMetadata = getLocaleMetadata;

export function resolveLocaleValue<Values extends LocaleValues<unknown>>(
    locale: SupportedLocale,
    values: Values,
): Values[SupportedLocale] {
    return values[locale];
}
