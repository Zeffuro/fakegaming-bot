import { resolveLocaleValue, type OutputLocaleValues, type SupportedOutputLocale } from '../../../core/localization.js';

export function leagueText(locale: SupportedOutputLocale, values: OutputLocaleValues<string>): string {
    return resolveLocaleValue(locale, values);
}

export function unknownError(locale: SupportedOutputLocale): string {
    return leagueText(locale, { en: 'Unknown error', nl: 'Onbekende fout' });
}

export function missingIdentity(locale: SupportedOutputLocale): string {
    return leagueText(locale, { en: 'Please provide a Riot ID and region, or link your account first.', nl: 'Geef een Riot ID en regio op, of koppel eerst je account.' });
}
