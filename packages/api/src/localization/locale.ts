import {
    DEFAULT_OUTPUT_LOCALE,
    resolveLocaleValue,
    resolveOutputLocaleFromAcceptLanguage,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { API_COPY, type ApiCopyKey } from './catalog.js';

export function resolveApiLocale(value: string | string[] | undefined): SupportedOutputLocale {
    return resolveOutputLocaleFromAcceptLanguage(value);
}

export function requestLocale(req: { headers?: { 'accept-language'?: string | string[] } }): SupportedOutputLocale {
    return resolveApiLocale(req.headers?.['accept-language']);
}

export async function resolveGuildOutputLocale(guildId: string | null | undefined): Promise<SupportedOutputLocale> {
    if (!guildId) return DEFAULT_OUTPUT_LOCALE;
    try {
        return await getConfigManager().guildLocaleConfigManager.getOutputLocale(guildId);
    } catch {
        return DEFAULT_OUTPUT_LOCALE;
    }
}

export async function resolveUserOutputLocale(discordId: string | null | undefined): Promise<SupportedOutputLocale> {
    if (!discordId) return DEFAULT_OUTPUT_LOCALE;
    try {
        return await getConfigManager().userManager.getPreferredLocale(discordId);
    } catch {
        return DEFAULT_OUTPUT_LOCALE;
    }
}

export function apiText(
    locale: SupportedOutputLocale,
    key: ApiCopyKey,
    values: Readonly<Record<string, string | number>> = {},
): string {
    return resolveLocaleValue(locale, API_COPY)[key].replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, name: string) => {
        const value = values[name];
        return value === undefined ? placeholder : String(value);
    });
}
