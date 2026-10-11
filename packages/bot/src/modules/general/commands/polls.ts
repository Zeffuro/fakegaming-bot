import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getConfigManager, PersonalError, PollError } from '@zeffuro/fakegaming-common/managers';
import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { createBotTranslator, resolveInteractionOutputLocale, type BotMessages } from '../../../core/localization.js';
import { polls as META } from '../commands.manifest.js';
import { getPollRuntime } from '../shared/pollRuntime.js';
import english from '../../../messages/en/pollTemplates.json' with { type: 'json' };
import dutch from '../../../messages/nl/pollTemplates.json' with { type: 'json' };

const data = createSlashCommand(META, (b: SlashCommandBuilder) => b
    .addSubcommand(sub => sub.setName('save').setDescription('Save the settings of a poll you created')
        .addStringOption(option => option.setName('poll').setDescription('Poll ID or message ID').setRequired(true))
        .addStringOption(option => option.setName('name').setDescription('Private template name').setMaxLength(120).setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List your private saved polls')
        .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1)))
    .addSubcommand(sub => sub.setName('show').setDescription('Show your saved poll settings')
        .addStringOption(option => option.setName('template').setDescription('Saved poll template ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete your saved poll without changing live polls')
        .addStringOption(option => option.setName('template').setDescription('Saved poll template ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('start').setDescription('Publish a fresh poll in this channel using your saved settings')
        .addStringOption(option => option.setName('template').setDescription('Saved poll template ID').setRequired(true))));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
    const t = createBotTranslator(locale, resolveLocaleValue(locale, { en: english, nl: dutch } satisfies OutputLocaleValues<BotMessages>));
    const manager = getConfigManager().pollTemplateManager; const userId = interaction.user.id;
    const action = interaction.options.getSubcommand();
    try {
        let content: string;
        if (action === 'save') {
            const saved = await manager.savePoll(userId, interaction.options.getString('poll', true), interaction.options.getString('name', true));
            content = t('saved', { title: saved.title, id: saved.id });
        } else if (action === 'list') {
            const saved = await manager.list(userId); const pages = Math.max(1, Math.ceil(saved.length / 5));
            const page = Math.min(interaction.options.getInteger('page') ?? 1, pages);
            content = saved.length ? [...saved.slice((page - 1) * 5, page * 5).map(item => `${item.title}\n${item.id}`), t('page', { page, pages })].join('\n\n') : t('empty');
        } else {
            const saved = await manager.get(interaction.options.getString('template', true), userId);
            if (!saved) throw new PersonalError('missing');
            if (action === 'delete') {
                await manager.remove(saved.id, userId, saved.version); content = t('removed');
            } else if (action === 'show') {
                content = `${saved.title}\n${saved.question}\n${saved.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}\n${t('settings', { duration: saved.durationMinutes, multiple: t(saved.allowMultiple ? 'yes' : 'no'), hidden: t(saved.hideResults ? 'yes' : 'no'), ranked: t(saved.ranked ? 'yes' : 'no') })}\n${saved.id}`;
            } else {
                const runtime = getPollRuntime();
                const publicLocale = await resolveInteractionOutputLocale(interaction);
                const publicCopy = createBotTranslator(publicLocale, resolveLocaleValue(publicLocale, { en: english, nl: dutch } satisfies OutputLocaleValues<BotMessages>));
                await interaction.editReply({ content: t('creating'), allowedMentions: { parse: [] } });
                const message = await interaction.followUp({ content: publicCopy('creating'), flags: [], allowedMentions: { parse: [] } });
                try {
                    const board = await manager.start(saved.id, userId, saved.version, runtime.manager, {
                        guildId: interaction.guildId ?? `dm:${userId}`, channelId: interaction.channelId, messageId: message.id, locale: publicLocale,
                    });
                    runtime.track(board); await runtime.refresh(board.id).catch(() => undefined); content = t('started');
                } catch (error) { await message.delete().catch(() => undefined); throw error; }
            }
        }
        await interaction.editReply({ content, allowedMentions: { parse: [] } });
    } catch (error) {
        const key = error instanceof PersonalError ? error.code : error instanceof PollError && error.code === 'capacity' ? 'capacity' : 'failed';
        await interaction.editReply({ content: t(key), allowedMentions: { parse: [] } });
    }
}
export default { data, execute, testOnly: getTestOnly(META) };
