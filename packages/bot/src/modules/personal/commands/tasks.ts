import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager, PersonalError, type UserTaskBoard } from '@zeffuro/fakegaming-common/managers';
import { parseReminderTime, parseReminderRecurrence, formatReminderRecurrence } from '@zeffuro/fakegaming-common/utils';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { tasks as META } from '../commands.manifest.js';
import { personalCopy, personalDelivery, personalFailure, personalLocale, personalPage, personalTimezone } from '../shared/personalCopy.js';

const data = createSlashCommand(META, b => {
    b.addSubcommand(s => s.setName('add').setDescription('Create a private task or checklist')
        .addStringOption(o => o.setName('title').setDescription('Task title').setMaxLength(120).setRequired(true))
        .addStringOption(o => o.setName('checklist').setDescription('Up to ten checklist items separated by |').setMaxLength(1210))
        .addStringOption(o => o.setName('due').setDescription('Future date, time or delay').setMaxLength(100))
        .addStringOption(o => o.setName('repeat').setDescription('Repeat after completion, e.g. daily or every 2 weeks').setMaxLength(100))
        .addStringOption(o => o.setName('timezone').setDescription('IANA timezone; defaults to your saved timezone or UTC').setMaxLength(100)));
    b.addSubcommand(s => s.setName('list').setDescription('List your tasks')
        .addBooleanOption(o => o.setName('completed').setDescription('Show completed tasks'))
        .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)));
    for (const [name, description] of [['show', 'Open a task and its controls'], ['done', 'Complete this occurrence'], ['snooze', 'Move this occurrence to a later time'], ['check', 'Toggle a checklist item'], ['delete', 'Delete a task']] as const) {
        b.addSubcommand(s => {
            s.setName(name).setDescription(description).addStringOption(o => o.setName('task').setDescription('Task ID from /tasks list').setRequired(true).setMaxLength(36));
            if (name === 'snooze') s.addStringOption(o => o.setName('when').setDescription('Future date, time or delay').setRequired(true).setMaxLength(100));
            if (name === 'check') s.addIntegerOption(o => o.setName('item').setDescription('Checklist item number').setRequired(true).setMinValue(1).setMaxValue(10));
            return s;
        });
    }
});

export function renderTask(task: UserTaskBoard, locale: SupportedOutputLocale) {
    const t = personalCopy(locale);
    const lines = [`**${task.title}**`, ...task.checklist.map((item, index) => `${index + 1}. ${item.done ? '☑' : '☐'} ${item.text}`),
        task.dueAt === null ? t('tasks.noDue') : t('tasks.due', { unix: Math.floor(task.dueAt / 1000) })];
    if (task.recurrence) lines.push(formatReminderRecurrence(task.recurrence, locale), t('tasks.repeating'));
    if (task.completedAt !== null) lines.push(t('tasks.completedAt', { unix: Math.floor(task.completedAt / 1000) }));
    lines.push(t('tasks.count', { count: task.completions }), t('common.id', { id: task.id }));
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (task.state === 'active') {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`user-task:d:${task.id}:${task.version}`).setLabel(t('tasks.done')).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`user-task:s:${task.id}:${task.version}`).setLabel(t('tasks.snooze')).setStyle(ButtonStyle.Secondary),
        ));
        for (let offset = 0; offset < task.checklist.length; offset += 5) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            task.checklist.slice(offset, offset + 5).map((_, i) => new ButtonBuilder().setCustomId(`user-task:c:${task.id}:${task.version}:${offset + i}`)
                .setLabel(t('tasks.check', { index: offset + i + 1 })).setStyle(ButtonStyle.Secondary)),
        ));
    }
    return { content: lines.join('\n'), components, allowedMentions: { parse: [] as never[] } };
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await personalLocale(interaction);
    const t = personalCopy(locale);
    const manager = getConfigManager().userTaskManager;
    try {
        const action = interaction.options.getSubcommand();
        if (action === 'list') {
            const completed = interaction.options.getBoolean('completed') ?? false;
            const page = personalPage(await manager.list(interaction.user.id, completed), interaction.options.getInteger('page') ?? 1);
            await interaction.editReply({ content: [t(completed ? 'tasks.completed' : 'tasks.title'), ...page.items.map(task =>
                `${task.title} — ${task.dueAt === null ? t('tasks.noDue') : `<t:${Math.floor(task.dueAt / 1000)}:R>`}\n${t('common.id', { id: task.id })}`),
                page.items.length ? t('common.page', { page: page.page, pages: page.pages }) : t('common.empty')].join('\n'), allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'add') {
            const timezone = await personalTimezone(interaction.user.id, interaction.options.getString('timezone'));
            const due = interaction.options.getString('due');
            const dueAt = due ? parseReminderTime(due, timezone)?.timestamp : null;
            const repeat = interaction.options.getString('repeat');
            const recurrence = repeat ? parseReminderRecurrence(repeat, timezone) : null;
            if ((due && !dueAt) || (repeat && !recurrence)) throw new PersonalError('invalid');
            await interaction.editReply(renderTask(await manager.create({ userId: interaction.user.id, title: interaction.options.getString('title', true),
                checklist: interaction.options.getString('checklist')?.split('|'), dueAt, timezone, recurrence }), locale));
            return;
        }
        const id = interaction.options.getString('task', true);
        if (action === 'delete') {
            if (!await manager.remove(id, interaction.user.id)) throw new PersonalError('missing');
            await interaction.editReply(t('common.removed'));
            return;
        }
        let task = await manager.get(id, interaction.user.id);
        if (!task) throw new PersonalError('missing');
        if (action === 'done') task = await manager.done(id, interaction.user.id, task.version);
        if (action === 'check') task = await manager.check(id, interaction.user.id, task.version, interaction.options.getInteger('item', true) - 1);
        if (action === 'snooze') {
            const time = parseReminderTime(interaction.options.getString('when', true), task.timezone);
            if (!time) throw new PersonalError('invalid');
            task = await manager.snooze(id, interaction.user.id, task.version, time.timestamp);
        }
        await interaction.editReply(renderTask(task, locale));
    } catch (error) { await interaction.editReply(personalFailure(error, locale)); }
}

async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('user-task:')) return false;
    await interaction.deferUpdate();
    const locale = await personalLocale(interaction);
    try {
        const [, action, id, rawVersion, extra] = interaction.customId.split(':');
        if (!id || !rawVersion || !/^\d+$/.test(rawVersion) || !['d', 's', 'c'].includes(action ?? '')) throw new PersonalError('invalid');
        const manager = getConfigManager().userTaskManager;
        const version = Number(rawVersion);
        const delivery = action === 'c' ? undefined : await personalDelivery(interaction, extra);
        const task = action === 'd' ? await manager.done(id, interaction.user.id, version, delivery)
            : action === 's' ? await manager.snooze(id, interaction.user.id, version, Date.now() + 600_000, delivery)
                : await manager.check(id, interaction.user.id, version, Number(extra));
        await interaction.editReply(renderTask(task, locale));
    } catch (error) { await interaction.followUp({ content: personalFailure(error, locale), flags: MessageFlags.Ephemeral }); }
    return true;
}

export default { data, execute, handleComponent, testOnly: false };
