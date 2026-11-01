import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import en from '../../../messages/en/submissions.json' with { type: 'json' };
import nl from '../../../messages/nl/submissions.json' with { type: 'json' };

export function submissionCopy(locale: SupportedOutputLocale) {
    return createBotTranslator(locale, resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<BotMessages>) as typeof en);
}

export class SubmissionControlError extends Error {
    constructor(public readonly code: 'unavailable' | 'setup' | 'missing' | 'imagesInvalid') {
        super(code);
    }
}

export function submissionFailure(error: unknown, locale: SupportedOutputLocale): string {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const keys = {
        unavailable: 'unavailable', setup: 'setup', missing: 'missing', imagesInvalid: 'imagesInvalid',
        'not-found': 'missing', forbidden: 'missing', stale: 'stale', 'invalid-state': 'stale',
        'invalid-category': 'unavailable', 'invalid-content': 'invalid', 'invalid-attachments': 'imagesInvalid',
        cooldown: 'cooldown', 'active-limit': 'capacity',
        uploadFailed: 'uploadFailed',
    } as const;
    return submissionCopy(locale)(keys[code as keyof typeof keys] ?? 'failure');
}
