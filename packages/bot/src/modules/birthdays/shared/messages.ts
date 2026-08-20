import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import type { SupportedOutputLocale } from '../../../core/localization.js';

export function subjectPossessive(targetUserId?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return targetUserId ? resolveLocaleValue(locale, { en: `<@${targetUserId}>'s`, nl: `<@${targetUserId}>` }) : resolveLocaleValue(locale, { en: 'Your', nl: 'Jouw' });
}

export function subjectNominative(targetUserId?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return targetUserId ? `<@${targetUserId}>` : resolveLocaleValue(locale, { en: 'You', nl: 'Je' });
}

// Backward-compatible alias used by existing imports
export const subjectForUser = subjectPossessive;
