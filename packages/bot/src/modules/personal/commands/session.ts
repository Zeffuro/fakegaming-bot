import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager, PersonalError, type UserSessionBoard } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { session as META } from '../commands.manifest.js';
import { personalCopy, personalFailure, personalLocale } from '../shared/personalCopy.js';

const data = createSlashCommand(META, b => {
    b.addSubcommand(s => s.setName('start').setDescription('Start a focus or gaming session')
        .addStringOption(o => o.setName('kind').setDescription('Session type').setRequired(true).addChoices({ name: 'Focus', value: 'focus' }, { name: 'Gaming', value: 'gaming' }))
        .addStringOption(o => o.setName('title').setDescription('Session title').setMaxLength(120))
        .addIntegerOption(o => o.setName('minutes').setDescription('Session or focus block minutes; Pomodoro defaults to 25').setMinValue(1).setMaxValue(1440))
        .addBooleanOption(o => o.setName('pomodoro').setDescription('Alternate focus and break blocks'))
        .addIntegerOption(o => o.setName('break-minutes').setDescription('Pomodoro break minutes; default 5').setMinValue(1).setMaxValue(60))
        .addIntegerOption(o => o.setName('cycles').setDescription('Pomodoro focus blocks; default 4').setMinValue(1).setMaxValue(12))
        .addIntegerOption(o => o.setName('break-every').setDescription('Optional break reminder after these active minutes').setMinValue(1).setMaxValue(1440)));
    for (const [name, description] of [['status', 'Show your active session'], ['pause', 'Pause your active session'], ['resume', 'Resume your paused session'], ['stop', 'Stop your active session'], ['stats', 'Show your retained time totals']] as const) {
        b.addSubcommand(s => s.setName(name).setDescription(description));
    }
});

export function renderSession(session: UserSessionBoard, locale: SupportedOutputLocale) {
    const t = personalCopy(locale);
    const content = [t('session.status', { kind: t(`session.${session.kind}`), title: session.title, state: t(`session.states.${session.state}`) }),
        t('session.time', { minutes: Math.floor(session.workMs / 60_000), breakMinutes: Math.floor(session.breakElapsedMs / 60_000) })];
    if (session.remainingMs !== null && ['running', 'paused'].includes(session.state)) content.push(t('session.remaining', { minutes: Math.ceil(session.remainingMs / 60_000) }));
    if (session.pomodoro) content.push(t('session.cycle', { cycle: session.cycleIndex, cycles: session.cycles, phase: t(`session.phases.${session.phase}`) }));
    content.push(t('common.id', { id: session.id }));
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (session.state === 'running' || session.state === 'paused') {
        const action = session.state === 'running' ? 'pause' : 'resume';
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`user-session:${action}:${session.id}:${session.version}`).setLabel(t(`session.${action}`)).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`user-session:stop:${session.id}:${session.version}`).setLabel(t('session.stop')).setStyle(ButtonStyle.Danger),
        ));
    }
    return { content: content.join('\n'), components, allowedMentions: { parse: [] as never[] } };
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await personalLocale(interaction);
    const t = personalCopy(locale);
    const manager = getConfigManager().userSessionManager;
    try {
        const action = interaction.options.getSubcommand();
        if (action === 'stats') {
            const totals = await manager.stats(interaction.user.id);
            await interaction.editReply(t('session.stats', { focus: Math.floor(totals.focusMs / 60_000), gaming: Math.floor(totals.gamingMs / 60_000), breaks: Math.floor(totals.breakMs / 60_000), count: totals.sessions }));
            return;
        }
        let session: UserSessionBoard | null;
        if (action === 'start') {
            const kind = interaction.options.getString('kind', true);
            if (kind !== 'focus' && kind !== 'gaming') throw new PersonalError('invalid');
            const title = interaction.options.getString('title') ?? t(`session.${kind}`);
            session = await manager.start({ userId: interaction.user.id, title, kind, minutes: interaction.options.getInteger('minutes'),
                pomodoro: interaction.options.getBoolean('pomodoro') ?? false, breakMinutes: interaction.options.getInteger('break-minutes') ?? undefined,
                cycles: interaction.options.getInteger('cycles') ?? undefined, breakEveryMinutes: interaction.options.getInteger('break-every'),
                messages: { focus: t('session.alertFocus', { title }), break: t('session.alertBreak', { title }), finished: t('session.alertFinished', { title }), takeBreak: t('session.alertTakeBreak', { title }) } });
        } else {
            session = await manager.getActive(interaction.user.id);
            if (session && (action === 'pause' || action === 'resume' || action === 'stop')) session = await manager.transition(session.id, interaction.user.id, session.version, action);
        }
        await interaction.editReply(session ? renderSession(session, locale) : { content: t('session.none'), components: [] });
    } catch (error) { await interaction.editReply(personalFailure(error, locale)); }
}

async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('user-session:')) return false;
    await interaction.deferUpdate();
    const locale = await personalLocale(interaction);
    try {
        const [, action, id, rawVersion] = interaction.customId.split(':');
        if (!id || !rawVersion || !/^\d+$/.test(rawVersion) || (action !== 'pause' && action !== 'resume' && action !== 'stop')) throw new PersonalError('invalid');
        const session = await getConfigManager().userSessionManager.transition(id, interaction.user.id, Number(rawVersion), action);
        await interaction.editReply(renderSession(session, locale));
    } catch (error) { await interaction.followUp({ content: personalFailure(error, locale), flags: MessageFlags.Ephemeral }); }
    return true;
}

export default { data, execute, handleComponent, testOnly: false };
