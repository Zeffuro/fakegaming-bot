import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { getConfigManager, PersonalError, type PersonalDeliveryScope } from '@zeffuro/fakegaming-common/managers';
import { createBotTranslator, resolveInteractionOutputLocale, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import english from '../../../messages/en/personal.json' with { type: 'json' };
import dutch from '../../../messages/nl/personal.json' with { type: 'json' };

export function personalCopy(locale: SupportedOutputLocale) {
    const messages = resolveLocaleValue(locale, { en: english, nl: dutch } satisfies OutputLocaleValues<BotMessages>) as typeof english;
    return createBotTranslator(locale, messages);
}

export async function personalLocale(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<SupportedOutputLocale> {
    return resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
}

export async function personalTimezone(userId: string, override?: string | null): Promise<string> {
    if (override?.trim()) return override.trim();
    return (await getConfigManager().userManager.getUser({ discordId: userId }))?.timezone?.trim() || 'UTC';
}

export function personalFailure(error: unknown, locale: SupportedOutputLocale): string {
    return personalCopy(locale)(error instanceof PersonalError ? `errors.${error.code}` : 'errors.failure');
}

export async function personalDelivery(interaction: ButtonInteraction, deliveryId?: string): Promise<PersonalDeliveryScope | undefined> {
    if (!deliveryId) return undefined;
    if (interaction.guildId || !interaction.channelId) throw new PersonalError('missing');
    const manager = getConfigManager().reminderInteractionManager;
    let delivery = await manager.getDelivery(deliveryId, interaction.user.id);
    if (!delivery) throw new PersonalError('missing');
    if (delivery.status === 'sending' || delivery.status === 'uncertain') {
        if (interaction.message.author.id !== interaction.client.user?.id) throw new PersonalError('missing');
        delivery = await manager.recoverDelivery(deliveryId, interaction.user.id, interaction.message.id, interaction.channelId);
    }
    if (!delivery || delivery.messageId !== interaction.message.id || delivery.channelId !== interaction.channelId) throw new PersonalError('missing');
    return { id: delivery.id, messageId: interaction.message.id, channelId: interaction.channelId };
}

export function personalPage<T>(items: readonly T[], page: number): { items: T[]; page: number; pages: number } {
    const pages = Math.max(1, Math.ceil(items.length / 6));
    const selected = Math.max(1, Math.min(page, pages));
    return { items: items.slice((selected - 1) * 6, selected * 6), page: selected, pages };
}
