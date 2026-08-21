import { runtimeText } from '../../../core/runtimeCopy.js';
import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import type { SupportedOutputLocale } from '../../../core/localization.js';

export function subjectPossessive(targetUserId?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return targetUserId ? runtimeText(locale, 'birthdays', 'possessiveMention', {userId: targetUserId}) : runtimeText(locale, 'birthdays', 'your');
}

export function subjectNominative(targetUserId?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return targetUserId ? `<@${targetUserId}>` : runtimeText(locale, "birthdays", "you");
}

// Backward-compatible alias used by existing imports
export const subjectForUser = subjectPossessive;
