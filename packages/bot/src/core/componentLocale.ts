import {
    DEFAULT_OUTPUT_LOCALE,
    isSupportedOutputLocale,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';

/** English IDs remain unsuffixed so existing component messages keep working. */
export function encodeComponentLocale(locale: SupportedOutputLocale): string {
    return locale === DEFAULT_OUTPUT_LOCALE ? '' : `:${locale}`;
}

export function parseComponentLocale(value: string | undefined): SupportedOutputLocale | null {
    return isSupportedOutputLocale(value) ? value : null;
}
