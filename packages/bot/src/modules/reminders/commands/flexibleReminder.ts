import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder,
    TextInputBuilder, TextInputStyle, type ButtonInteraction,
    type MessageContextMenuCommandInteraction, type ModalSubmitInteraction,
} from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { parseReminderTime } from '@zeffuro/fakegaming-common/utils';
import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createMessageContextCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { createBotTranslator, resolveInteractionOutputLocale, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import { flexibleReminder as META } from '../commands.manifest.js';
import { getReminderCopy } from '../copy/reminderCopy.js';
import en from '../../../messages/en/reminders.json' with { type: 'json' };
import nl from '../../../messages/nl/reminders.json' with { type: 'json' };

const data = createMessageContextCommand(META);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReminderInteractionManager = ReturnType<typeof getConfigManager>['reminderInteractionManager'];
type UserManager = Pick<ReturnType<typeof getConfigManager>['userManager'], 'getUser'>;
type ReminderInteraction = ButtonInteraction | ModalSubmitInteraction;

function translate(locale: SupportedOutputLocale) {
    const messages = resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<BotMessages>);
    return createBotTranslator(locale, messages);
}

export function createFlexibleReminderHandlers(manager: ReminderInteractionManager, users: UserManager) {
    async function timezone(userId: string, override?: string): Promise<string> {
        return override?.trim() || (await users.getUser({ discordId: userId }))?.timezone?.trim() || 'UTC';
    }

    async function available(interaction: ReminderInteraction, id: string, draft: boolean): Promise<boolean> {
        if (draft) {
            const record = await manager.getDraft(id, interaction.user.id);
            return Boolean(record && record.userId === interaction.user.id);
        }
        if (interaction.guildId || !interaction.message || !interaction.channelId) return false;
        let delivery = await manager.getDelivery(id, interaction.user.id);
        if (!delivery || delivery.userId !== interaction.user.id) return false;
        if (delivery.status === 'sending' || delivery.status === 'uncertain') {
            const botId = interaction.client.user?.id;
            if (!botId || interaction.message.author.id !== botId) return false;
            delivery = await manager.recoverDelivery(id, interaction.user.id, interaction.message.id, interaction.channelId);
        }
        return Boolean(delivery && delivery.userId === interaction.user.id && delivery.status === 'delivered'
            && delivery.messageId === interaction.message.id && delivery.channelId === interaction.channelId);
    }

    async function unavailable(interaction: ReminderInteraction, locale: SupportedOutputLocale): Promise<void> {
        const payload = { content: translate(locale)('flexible.unavailable'), allowedMentions: { parse: [] as const } };
        if (interaction.deferred) await interaction.editReply(payload);
        else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    async function schedule(interaction: ReminderInteraction, id: string, draft: boolean, input: string, override?: string): Promise<void> {
        if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const locale = await resolveInteractionOutputLocale(interaction);
        if (!await available(interaction, id, draft)) return unavailable(interaction, locale);
        const parsed = parseReminderTime(input, await timezone(interaction.user.id, override));
        if (!parsed) {
            await interaction.editReply({ content: translate(locale)('flexible.invalidTime'), allowedMentions: { parse: [] } });
            return;
        }
        const saved = draft
            ? await manager.scheduleDraft(id, interaction.user.id, parsed.timestamp, parsed.timespan)
            : await manager.snoozeDelivery(id, interaction.user.id, parsed.timestamp, parsed.timespan, interaction.message!.id, interaction.channelId!);
        if (!saved) return unavailable(interaction, locale);
        await interaction.editReply({ content: getReminderCopy(locale).oneHourSet(Math.floor(parsed.timestamp / 1000)), allowedMentions: { parse: [] } });
        if (!draft && interaction.message) {
            await interaction.message.edit({ components: [] }).catch(() => undefined);
        }
    }

    return {
        execute: async (interaction: MessageContextMenuCommandInteraction): Promise<void> => {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const locale = await resolveInteractionOutputLocale(interaction);
            const t = translate(locale);
            const copy = getReminderCopy(locale);
            if (!interaction.guildId) {
                await interaction.editReply({ content: copy.serverOnly });
                return;
            }
            const target = interaction.targetMessage;
            const url = target.url || `https://discord.com/channels/${interaction.guildId}/${target.channelId}/${target.id}`;
            const draft = await manager.createDraft(interaction.user.id, copy.followUpMessage(url));
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                ...(['600', '3600', 'tomorrow', 'custom'] as const).map((delay, index) => new ButtonBuilder()
                    .setCustomId(delay === 'custom' ? `reminder:custom-draft:${draft.id}` : `reminder:draft:${draft.id}:${delay}`)
                    .setLabel(t(`flexible.${(['tenMinutes', 'oneHour', 'tomorrow', 'custom'] as const)[index]!}`))
                    .setStyle(ButtonStyle.Secondary)),
            );
            await interaction.editReply({ content: t('flexible.chooseTime'), components: [row], allowedMentions: { parse: [] } });
        },
        handleComponent: async (interaction: ButtonInteraction): Promise<boolean> => {
            const [prefix, action, id, delay, extra] = interaction.customId.split(':');
            if (prefix !== 'reminder') return false;
            const custom = (action === 'custom-draft' || action === 'custom-snooze') && !delay && !extra && Boolean(id && UUID.test(id));
            if (!custom) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            if (!id || !UUID.test(id) || extra) {
                await unavailable(interaction, await resolveInteractionOutputLocale(interaction));
                return true;
            }
            if ((action === 'draft' || action === 'snooze') && (delay === '600' || delay === '3600' || (action === 'draft' && delay === 'tomorrow'))) {
                await schedule(interaction, id, action === 'draft', delay === 'tomorrow' ? 'tomorrow' : `${delay}s`);
                return true;
            }
            if ((action === 'custom-draft' || action === 'custom-snooze') && !delay) {
                const [locale, isAvailable] = await Promise.all([
                    resolveInteractionOutputLocale(interaction), available(interaction, id, action === 'custom-draft'),
                ]);
                if (!isAvailable) {
                    await unavailable(interaction, locale);
                    return true;
                }
                const t = translate(locale);
                const modal = new ModalBuilder().setCustomId(`reminder:${action}:${id}`).setTitle(t('flexible.customTitle'));
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
                        .setCustomId('when').setLabel(t('flexible.whenLabel')).setPlaceholder(t('flexible.whenPlaceholder'))
                        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
                        .setCustomId('timezone').setLabel(t('flexible.timezoneLabel')).setPlaceholder(t('flexible.timezonePlaceholder'))
                        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)),
                );
                await interaction.showModal(modal);
                return true;
            }
            if (action === 'dismiss' && !delay) {
                const locale = await resolveInteractionOutputLocale(interaction);
                if (!await available(interaction, id, false)
                    || !await manager.dismissDelivery(id, interaction.user.id, interaction.message.id, interaction.channelId)) {
                    await unavailable(interaction, locale);
                    return true;
                }
                await interaction.editReply({ content: translate(locale)('flexible.dismissed'), allowedMentions: { parse: [] } });
                await interaction.message.edit({ components: [] }).catch(() => undefined);
                return true;
            }
            await unavailable(interaction, await resolveInteractionOutputLocale(interaction));
            return true;
        },
        handleModal: async (interaction: ModalSubmitInteraction): Promise<boolean> => {
            const [prefix, action, id, extra] = interaction.customId.split(':');
            if (prefix !== 'reminder') return false;
            if (!id || !UUID.test(id) || extra || (action !== 'custom-draft' && action !== 'custom-snooze')) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await unavailable(interaction, await resolveInteractionOutputLocale(interaction));
                return true;
            }
            await schedule(interaction, id, action === 'custom-draft', interaction.fields.getTextInputValue('when'), interaction.fields.getTextInputValue('timezone'));
            return true;
        },
    };
}

const config = getConfigManager();
const handlers = createFlexibleReminderHandlers(config.reminderInteractionManager, config.userManager);
const testOnly = getTestOnly(META);

export default { data, ...handlers, testOnly };

