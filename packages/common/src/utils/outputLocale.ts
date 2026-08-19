export const SUPPORTED_OUTPUT_LOCALES = ['en', 'nl'] as const;

export type SupportedOutputLocale = typeof SUPPORTED_OUTPUT_LOCALES[number];

export const DEFAULT_OUTPUT_LOCALE: SupportedOutputLocale = 'en';

export function isSupportedOutputLocale(value: unknown): value is SupportedOutputLocale {
    return typeof value === 'string' && (SUPPORTED_OUTPUT_LOCALES as readonly string[]).includes(value);
}
