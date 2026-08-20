// Persist primary language keys; regional formatting belongs in locale metadata.
export const SUPPORTED_OUTPUT_LOCALES = ['en', 'nl'] as const;

export type SupportedOutputLocale = typeof SUPPORTED_OUTPUT_LOCALES[number];

export const DEFAULT_OUTPUT_LOCALE = 'en' as const satisfies SupportedOutputLocale;

export type NonDefaultOutputLocale = Exclude<SupportedOutputLocale, typeof DEFAULT_OUTPUT_LOCALE>;

export const NON_DEFAULT_OUTPUT_LOCALES: readonly NonDefaultOutputLocale[] = Object.freeze(
    SUPPORTED_OUTPUT_LOCALES.filter(
        (locale): locale is NonDefaultOutputLocale => locale !== DEFAULT_OUTPUT_LOCALE,
    ),
);

export type OutputLocaleValues<T> = Readonly<Record<SupportedOutputLocale, T>>;

export interface OutputLocaleMetadata {
    languageTag: string;
    htmlLang: string;
    nativeName: string;
}

export const OUTPUT_LOCALE_METADATA = {
    en: {
        languageTag: 'en-US',
        htmlLang: 'en',
        nativeName: 'English',
    },
    nl: {
        languageTag: 'nl-NL',
        htmlLang: 'nl',
        nativeName: 'Nederlands',
    },
} as const satisfies OutputLocaleValues<OutputLocaleMetadata>;

export function isSupportedOutputLocale(value: unknown): value is SupportedOutputLocale {
    return typeof value === 'string' && (SUPPORTED_OUTPUT_LOCALES as readonly string[]).includes(value);
}

export function resolveOutputLocaleFromAcceptLanguage(
    value: string | readonly string[] | null | undefined,
): SupportedOutputLocale {
    if (!value) return DEFAULT_OUTPUT_LOCALE;
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
        if (isSupportedOutputLocale(primary)) return primary;
        if (preference.tag === '*') return DEFAULT_OUTPUT_LOCALE;
    }

    return DEFAULT_OUTPUT_LOCALE;
}

export function getOutputLocaleMetadata(locale: SupportedOutputLocale): OutputLocaleMetadata {
    return OUTPUT_LOCALE_METADATA[locale];
}

export function resolveLocaleValue<Values extends OutputLocaleValues<unknown>>(
    locale: SupportedOutputLocale,
    values: Values,
): Values[SupportedOutputLocale] {
    return values[locale];
}
