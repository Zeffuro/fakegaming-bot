import {
    DEFAULT_OUTPUT_LOCALE,
    getOutputLocaleMetadata,
    resolveOutputLocaleFromAcceptLanguage,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createTranslator } from 'use-intl/core';
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

export type ApiTextValues = Readonly<Record<string, string | number | Date>>;
type ApiTranslator = (key: ApiCopyKey, values?: ApiTextValues) => string;

const apiTranslators = new Map<SupportedOutputLocale, ApiTranslator>();

export function createApiTranslator(locale: SupportedOutputLocale): ApiTranslator {
    const existing = apiTranslators.get(locale);
    if (existing) return existing;

    const translate = createTranslator({
        locale: getOutputLocaleMetadata(locale).formatTag,
        messages: API_COPY[locale],
    });

    const translator: ApiTranslator = (key, values = {}) => translate(key, values);
    apiTranslators.set(locale, translator);
    return translator;
}

export function apiText(locale: SupportedOutputLocale, key: ApiCopyKey, values: ApiTextValues = {}): string {
    return createApiTranslator(locale)(key, values);
}
