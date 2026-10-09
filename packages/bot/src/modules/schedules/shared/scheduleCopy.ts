import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, resolveInteractionOutputLocale, type BotMessages, type LocaleAwareInteraction, type SupportedOutputLocale } from '../../../core/localization.js';
import en from '../../../messages/en/schedules.json' with { type: 'json' };
import nl from '../../../messages/nl/schedules.json' with { type: 'json' };

export function scheduleCopy(locale: SupportedOutputLocale) {
    return createBotTranslator(locale, resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<BotMessages>) as typeof en);
}

export function scheduleLocale(interaction: LocaleAwareInteraction) {
    return resolveInteractionOutputLocale({ ...interaction, guildId: null, user: interaction.user, locale: interaction.locale });
}

export function scheduleFailure(error: unknown, locale: SupportedOutputLocale): string {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'failure';
    return scheduleCopy(locale)(code === 'stale' ? 'stale' : code === 'missing' ? 'missing' : code === 'invalid' ? 'invalid' : code === 'capacity' ? 'capacity' : 'failure');
}

export function invalidSchedule(): never { throw Object.assign(new Error('Invalid schedule input'), { code: 'invalid' }); }

export function personalDashboardUrl(): string | null {
    const configured = process.env.DASHBOARD_URL?.trim() || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
    try {
        const url = new URL(configured);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        url.pathname = `${url.pathname.replace(/\/$/, '')}/dashboard/me`;
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch { return null; }
}
