import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { parseReminderTime } from '@zeffuro/fakegaming-common/utils';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import { schedule as META } from '../commands.manifest.js';
import { invalidSchedule, personalDashboardUrl, scheduleCopy, scheduleFailure, scheduleLocale } from '../shared/scheduleCopy.js';
import { parseCompletedTime } from '../shared/completedTime.js';
import { renderHistory, renderSchedule, scheduleTime } from '../shared/renderSchedule.js';
import { handleComponent, handleModal } from '../shared/scheduleInteractions.js';

const data = createSlashCommand(META, b => {
    b.addSubcommand(s => s.setName('add').setDescription('Create a fixed private schedule')
        .addStringOption(o => o.setName('title').setDescription('Private title').setRequired(true).setMaxLength(120))
        .addStringOption(o => o.setName('at').setDescription('Future exact date and time').setRequired(true).setMaxLength(100))
        .addStringOption(o => o.setName('timezone').setDescription('IANA timezone; defaults to your saved timezone').setMaxLength(100))
        .addIntegerOption(o => o.setName('repeat-weeks').setDescription('Fixed interval in weeks; omit for one occurrence').setMinValue(1).setMaxValue(52)));
    b.addSubcommand(s => s.setName('list').setDescription('List private occurrences')
        .addStringOption(o => o.setName('filter').setDescription('Occurrence state').addChoices(...['upcoming', 'unconfirmed', 'completed', 'all'].map(value => ({ name: value, value }))))
        .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)));
    for (const [name, description] of [['show', 'Open private occurrence controls'], ['complete', 'Confirm completion now or at an earlier time'],
        ['correct', 'Correct the completion timestamp'], ['undo', 'Undo a completion'], ['snooze', 'Remind later without moving the schedule'],
        ['note', 'Set or remove a private note'], ['history', 'Show all private history or filter by an occurrence'], ['summary', 'Show last completed and next planned']] as const) {
        b.addSubcommand(s => {
            s.setName(name).setDescription(description).addStringOption(o => o.setName('occurrence')
                .setDescription(name === 'history' ? 'Optional occurrence ID to show only its schedule history' : 'Occurrence ID from /schedule list')
                .setRequired(name !== 'history').setMaxLength(36));
            if (name === 'complete' || name === 'correct') s.addStringOption(o => o.setName('at').setDescription('Past exact date and time with optional ISO offset').setRequired(name === 'correct').setMaxLength(100));
            if (name === 'snooze') s.addStringOption(o => o.setName('when').setDescription('Future date, time or delay').setRequired(true).setMaxLength(100));
            if (name === 'note') s.addStringOption(o => o.setName('text').setDescription('Private note; omit to remove').setMaxLength(1000));
            if (name === 'history') s.addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1));
            return s;
        });
    }
    for (const name of ['pause', 'resume'] as const) b.addSubcommand(s => s.setName(name).setDescription(name === 'pause' ? 'Pause a private schedule' : 'Resume a private schedule')
        .addStringOption(o => o.setName('schedule').setDescription('Schedule ID from /schedule show').setRequired(true).setMaxLength(36)));
    b.addSubcommand(s => s.setName('configure').setDescription('Set private follow-ups and quiet hours')
        .addStringOption(o => o.setName('timezone').setDescription('IANA timezone for quiet hours').setMaxLength(100))
        .addStringOption(o => o.setName('quiet-start').setDescription('Quiet hours start HH:mm; pair with quiet-end').setMaxLength(5))
        .addStringOption(o => o.setName('quiet-end').setDescription('Quiet hours end HH:mm; pair with quiet-start').setMaxLength(5))
        .addBooleanOption(o => o.setName('clear-quiet').setDescription('Remove quiet hours'))
        .addIntegerOption(o => o.setName('followup-minutes').setDescription('Minutes between follow-ups; at least 15 when enabled').setMinValue(0).setMaxValue(10080))
        .addIntegerOption(o => o.setName('max-followups').setDescription('Maximum follow-ups; zero disables them').setMinValue(0).setMaxValue(8)));
    b.addSubcommand(s => s.setName('export').setDescription('Export all retained private completion history')
        .addStringOption(o => o.setName('format').setDescription('Export format').setRequired(true).addChoices({ name: 'JSON', value: 'json' }, { name: 'CSV', value: 'csv' })));
    b.addSubcommand(s => s.setName('connect').setDescription('Choose Google calendars in your private dashboard'));
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await scheduleLocale(interaction);
    const t = scheduleCopy(locale);
    const manager = getConfigManager().userScheduleManager;
    const userId = interaction.user.id;
    const options = interaction.options;
    const action = options.getSubcommand();
    try {
        if (action === 'connect') {
            const url = personalDashboardUrl();
            await interaction.editReply({ content: t(url ? 'connect' : 'notConfigured'), components: url ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(t('open')))] : [], allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'export') {
            const format = options.getString('format', true);
            if (format !== 'json' && format !== 'csv') invalidSchedule();
            const exported = await manager.export(userId, format);
            if (Buffer.byteLength(exported, 'utf8') > 8_000_000) {
                await interaction.editReply({ content: t('exportTooLarge'), allowedMentions: { parse: [] } });
                return;
            }
            await interaction.editReply({ content: t('exported'), files: [new AttachmentBuilder(Buffer.from(exported, 'utf8'), { name: `schedule-history.${format}` })], allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'list') {
            const filter = options.getString('filter') ?? 'upcoming';
            if (!['upcoming', 'unconfirmed', 'completed', 'all'].includes(filter)) invalidSchedule();
            await interaction.editReply(renderHistory(await manager.list(userId, filter as 'upcoming' | 'unconfirmed' | 'completed' | 'all'), locale, options.getInteger('page') ?? 1));
            return;
        }
        if (action === 'add' || action === 'configure') {
            const savedTimezone = (await getConfigManager().userManager.getUser({ discordId: userId }))?.timezone || 'UTC';
            const preferences = await manager.preferences(userId, savedTimezone);
            const timezone = options.getString('timezone')?.trim() || preferences.timezone;
            if (action === 'add') {
                const time = parseReminderTime(options.getString('at', true), timezone);
                if (!time) invalidSchedule();
                await interaction.editReply(renderSchedule(await manager.createManual({ userId, title: options.getString('title', true), plannedAt: time.timestamp,
                    timezone, repeatWeeks: options.getInteger('repeat-weeks') }), locale));
            } else {
                const clear = options.getBoolean('clear-quiet') ?? false;
                const start = options.getString('quiet-start');
                const end = options.getString('quiet-end');
                if (Boolean(start) !== Boolean(end) || (clear && (start || end))) invalidSchedule();
                await manager.configure(userId, { timezone, quietStart: clear ? null : start ?? preferences.quietStart,
                    quietEnd: clear ? null : end ?? preferences.quietEnd, followupMinutes: options.getInteger('followup-minutes') ?? preferences.followupMinutes,
                    maxFollowups: options.getInteger('max-followups') ?? preferences.maxFollowups });
                await interaction.editReply({ content: t('configured'), allowedMentions: { parse: [] } });
            }
            return;
        }
        if (action === 'pause' || action === 'resume') {
            if (!await manager.setEnabled(options.getString('schedule', true), userId, action === 'resume')) throw Object.assign(new Error('Missing'), { code: 'missing' });
            await interaction.editReply({ content: t(action === 'pause' ? 'paused' : 'resumed'), allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'history' && options.getString('occurrence') === null) {
            await interaction.editReply(renderHistory(await manager.list(userId, 'all'), locale, options.getInteger('page') ?? 1));
            return;
        }
        const id = options.getString('occurrence', true);
        let item = await manager.get(id, userId);
        if (!item) throw Object.assign(new Error('Missing'), { code: 'missing' });
        if (action === 'history') {
            await interaction.editReply(renderHistory(await manager.list(userId, 'all', item.scheduleId), locale, options.getInteger('page') ?? 1));
            return;
        }
        if (action === 'summary') {
            const summary = await manager.summary(userId, item.scheduleId);
            const value = (entry: typeof item) => entry ? `${entry.title} — ${scheduleTime(entry.completedAt ?? entry.plannedAt, entry.timezone, locale)}` : t('none');
            await interaction.editReply({ content: [t('last', { value: value(summary.last) }), t('next', { value: value(summary.next) }), t('unconfirmed', { count: summary.unconfirmed })].join('\n'), allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'complete' || action === 'correct') {
            const at = options.getString('at');
            const completedAt = at ? parseCompletedTime(at, item.timezone) : Date.now();
            if (completedAt === null || (action === 'correct' && item.state !== 'completed')) invalidSchedule();
            item = await manager.complete(id, userId, item.version, completedAt);
        } else if (action === 'undo') item = await manager.undo(id, userId, item.version);
        else if (action === 'note') item = await manager.note(id, userId, item.version, options.getString('text') ?? '');
        else if (action === 'snooze') {
            const time = parseReminderTime(options.getString('when', true), item.timezone);
            if (!time) invalidSchedule();
            item = await manager.snooze(id, userId, item.version, time.timestamp);
        }
        await interaction.editReply(renderSchedule(item, locale));
    } catch (error) { await interaction.editReply({ content: scheduleFailure(error, locale), components: [], allowedMentions: { parse: [] } }); }
}

export default { data, execute, handleComponent, handleModal, testOnly: false };
