import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager, PersonalError, type UserCountdownBoard } from '@zeffuro/fakegaming-common/managers';
import { parseReminderTime } from '@zeffuro/fakegaming-common/utils';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { countdowns as META } from '../commands.manifest.js';
import { personalCopy, personalFailure, personalLocale, personalPage, personalTimezone } from '../shared/personalCopy.js';

const data = createSlashCommand(META, b => {
    b.addSubcommand(s => s.setName('add').setDescription('Create a countdown to a future date')
        .addStringOption(o => o.setName('title').setDescription('Countdown title').setMaxLength(120).setRequired(true))
        .addStringOption(o => o.setName('at').setDescription('Exact date and time, e.g. 2026-12-25 09:00').setMaxLength(100).setRequired(true))
        .addStringOption(o => o.setName('timezone').setDescription('IANA timezone; defaults to your saved timezone or UTC').setMaxLength(100))
        .addIntegerOption(o => o.setName('advance-minutes').setDescription('Optional alert this many minutes before the date').setMinValue(1).setMaxValue(525600)));
    b.addSubcommand(s => s.setName('list').setDescription('List upcoming countdowns in date order')
        .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)));
    for (const [name, description] of [['show', 'Show a countdown'], ['delete', 'Delete a countdown and its alerts']] as const) {
        b.addSubcommand(s => s.setName(name).setDescription(description)
            .addStringOption(o => o.setName('countdown').setDescription('Countdown ID from /countdowns list').setRequired(true).setMaxLength(36)));
    }
});

export function renderCountdown(item: UserCountdownBoard, locale: SupportedOutputLocale): string {
    const t = personalCopy(locale);
    return [t('countdowns.entry', { title: item.title, unix: Math.floor(item.dueAt / 1000), timezone: item.timezone, id: item.id }),
        ...(item.advanceMinutes === null ? [] : [t('countdowns.advance', { minutes: item.advanceMinutes })])].join('\n');
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await personalLocale(interaction);
    const t = personalCopy(locale);
    const manager = getConfigManager().userCountdownManager;
    try {
        const action = interaction.options.getSubcommand();
        let content: string;
        if (action === 'add') {
            const timezone = await personalTimezone(interaction.user.id, interaction.options.getString('timezone'));
            const parsed = parseReminderTime(interaction.options.getString('at', true), timezone);
            if (!parsed) throw new PersonalError('invalid');
            const title = interaction.options.getString('title', true);
            const countdown = await manager.create({ userId: interaction.user.id, title, dueAt: parsed.timestamp, timezone,
                advanceMinutes: interaction.options.getInteger('advance-minutes'), dueMessage: t('countdowns.dueMessage', { title }),
                advanceMessage: t('countdowns.advanceMessage', { title, unix: Math.floor(parsed.timestamp / 1000) }) });
            content = renderCountdown(countdown, locale);
        } else if (action === 'list') {
            const page = personalPage(await manager.list(interaction.user.id), interaction.options.getInteger('page') ?? 1);
            content = [t('countdowns.title'), ...page.items.map(item => renderCountdown(item, locale)),
                page.items.length ? t('common.page', { page: page.page, pages: page.pages }) : t('common.empty')].join('\n');
        } else {
            const id = interaction.options.getString('countdown', true);
            if (action === 'delete') {
                if (!await manager.remove(id, interaction.user.id)) throw new PersonalError('missing');
                content = t('common.removed');
            } else {
                const item = await manager.get(id, interaction.user.id);
                if (!item) throw new PersonalError('missing');
                content = renderCountdown(item, locale);
            }
        }
        await interaction.editReply({ content, allowedMentions: { parse: [] } });
    } catch (error) { await interaction.editReply(personalFailure(error, locale)); }
}

export default { data, execute, testOnly: false };
