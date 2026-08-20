import {
    DEFAULT_OUTPUT_LOCALE,
    isSupportedOutputLocale,
    resolveLocaleValue,
    type OutputLocaleValues,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

export {
    SUPPORTED_OUTPUT_LOCALES,
    DEFAULT_OUTPUT_LOCALE,
    getOutputLocaleMetadata,
    isSupportedOutputLocale,
    resolveLocaleValue,
    type OutputLocaleValues,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';

export type LocaleCatalog<Key extends string> = Readonly<Record<Key, OutputLocaleValues<string>>>;

export function createLocaleCatalog<Key extends string>(catalog: LocaleCatalog<Key>): LocaleCatalog<Key> {
    return Object.freeze(catalog);
}

/**
 * Accepts a persisted guild preference without coupling command code to its
 * storage. Unknown and absent values deliberately use English.
 */
export function resolveOutputLocale(preferredGuildLocale?: unknown): SupportedOutputLocale {
    return isSupportedOutputLocale(preferredGuildLocale) ? preferredGuildLocale : DEFAULT_OUTPUT_LOCALE;
}

export interface LocaleAwareInteraction {
    guildId: string | null;
    locale?: string;
    user?: { id: string };
}

export async function resolveInteractionOutputLocale(
    interaction: LocaleAwareInteraction,
    getStoredGuildLocale: (guildId: string) => Promise<unknown> = guildId =>
        getConfigManager().guildLocaleConfigManager.getOutputLocale(guildId),
    getStoredUserLocale: (userId: string) => Promise<unknown> = async userId => {
        const user = await getConfigManager().userManager.getUser({ discordId: userId });
        return (user as unknown as { preferredLocale?: unknown } | null)?.preferredLocale;
    },
): Promise<SupportedOutputLocale> {
    if (interaction.guildId) {
        try {
            return resolveOutputLocale(await getStoredGuildLocale(interaction.guildId));
        } catch {
            return DEFAULT_OUTPUT_LOCALE;
        }
    }
    if (interaction.user?.id) {
        try {
            const storedLocale = await getStoredUserLocale(interaction.user.id);
            if (isSupportedOutputLocale(storedLocale)) return storedLocale;
        } catch {
            // Discord's interaction locale remains a safe fallback for DMs.
        }
    }
    return resolveOutputLocale(interaction.locale);
}

/**
 * Resolves locale-specific application copy. A missing catalog key is returned
 * unchanged so callers can surface and diagnose it without failing an interaction.
 */
export function translate<Key extends string>(
    catalog: LocaleCatalog<Key>,
    locale: SupportedOutputLocale,
    key: string,
): string {
    const entry = catalog[key as Key];
    if (!entry) return key;

    return resolveLocaleValue(locale, entry);
}

export function formatTranslation(template: string, values: Readonly<Record<string, string>>): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}
