import { resolveLocaleValue, type OutputLocaleValues, type SupportedOutputLocale } from '../../../core/localization.js';

export function quoteText(locale: SupportedOutputLocale, values: OutputLocaleValues<string>): string {
    return resolveLocaleValue(locale, values);
}
