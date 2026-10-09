import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { findPersonalTwitchUser } from '@zeffuro/fakegaming-common/notifications';
import { resolveSteamAppInput, searchSteamApps } from '@zeffuro/fakegaming-common/steam';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import { createBotTranslator, resolveInteractionOutputLocale, resolveLocaleValue, type OutputLocaleValues, type BotMessages } from '../../../core/localization.js';
import { follows as META } from '../commands.manifest.js';
import en from '../../../messages/en/follows.json' with { type: 'json' };
import nl from '../../../messages/nl/follows.json' with { type: 'json' };

const data = createSlashCommand(META, builder => {
    builder.addSubcommand(sub => sub.setName('twitch').setDescription('Follow a Twitch channel privately')
        .addStringOption(option => option.setName('username').setDescription('Twitch username').setRequired(true).setMaxLength(26))
        .addStringOption(option => option.setName('mode').setDescription('Immediate DM or daily digest').addChoices({ name: 'Immediate', value: 'immediate' }, { name: 'Daily digest', value: 'digest' })));
    builder.addSubcommand(sub => sub.setName('steam').setDescription('Follow Steam game news privately')
        .addStringOption(option => option.setName('game').setDescription('Steam game name, App ID, or store URL').setRequired(true).setAutocomplete(true))
        .addStringOption(option => option.setName('mode').setDescription('Immediate DM or daily digest').addChoices({ name: 'Immediate', value: 'immediate' }, { name: 'Daily digest', value: 'digest' })));
    builder.addSubcommand(sub => sub.setName('list').setDescription('List your private follows')
        .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1)));
    for (const action of ['pause', 'resume', 'remove'] as const) {
        builder.addSubcommand(sub => sub.setName(action).setDescription(({ pause: 'Pause a private follow', resume: 'Resume a private follow', remove: 'Remove a private follow' })[action])
            .addStringOption(option => option.setName('id').setDescription('Follow from your list').setRequired(true).setAutocomplete(true)));
    }
    builder.addSubcommand(sub => sub.setName('settings').setDescription('View or change quiet hours and daily digest time')
        .addStringOption(option => option.setName('timezone').setDescription('Your timezone, e.g. Europe/Amsterdam').setMaxLength(100))
        .addStringOption(option => option.setName('quiet-start').setDescription('Quiet hours start, HH:mm').setMaxLength(5))
        .addStringOption(option => option.setName('quiet-end').setDescription('Quiet hours end, HH:mm').setMaxLength(5))
        .addBooleanOption(option => option.setName('clear-quiet').setDescription('Turn quiet hours off'))
        .addStringOption(option => option.setName('digest-at').setDescription('Daily digest time, HH:mm').setMaxLength(5)));
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
    const t = createBotTranslator(locale, resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<BotMessages>));
    const cm = getConfigManager();
    const manager = cm.userFollowManager;
    const userId = interaction.user.id;
    const action = interaction.options.getSubcommand(true);
    try {
        if (action === 'twitch' || action === 'steam') {
            let target: string;
            let label: string;
            if (action === 'twitch') {
                const user = await findPersonalTwitchUser(interaction.options.getString('username', true));
                if (!user) { await interaction.editReply({ content: t('notFound') }); return; }
                target = user.login;
                label = user.display_name;
            } else {
                const result = await resolveSteamAppInput(interaction.options.getString('game', true));
                if (result.status !== 'resolved') {
                    await interaction.editReply({ content: result.status === 'ambiguous' ? t('ambiguous') : t('notFound') }); return;
                }
                target = String(result.app.steamAppId);
                label = result.app.appName;
            }
            const mode = interaction.options.getString('mode') === 'digest' ? 'digest' : 'immediate';
            await manager.preferences(userId, (await cm.userManager.getUser({ discordId: userId }))?.timezone || 'UTC');
            await manager.add(userId, action, target, label, mode);
            await interaction.editReply({ content: t('added', { label, mode: t(mode) }), allowedMentions: { parse: [] } }); return;
        }
        if (action === 'list') {
            const all = await manager.list(userId);
            const page = interaction.options.getInteger('page') ?? 1;
            const selected = all.slice((page - 1) * 10, page * 10);
            const lines = selected.map(follow => `\`${follow.id}\` **${follow.label.slice(0, 100)}** (${follow.provider}) — ${t(follow.mode)}${follow.paused ? ` · ${t('paused')}` : ''}`);
            await interaction.editReply({ content: lines.length ? `${t('list')} ${page}/${Math.ceil(all.length / 10)}\n${lines.join('\n')}`.slice(0, 2000) : t('empty'), allowedMentions: { parse: [] } }); return;
        }
        if (action === 'settings') {
            const saved = await manager.preferences(userId, (await cm.userManager.getUser({ discordId: userId }))?.timezone || 'UTC');
            const clear = interaction.options.getBoolean('clear-quiet') ?? false;
            const start = interaction.options.getString('quiet-start');
            const end = interaction.options.getString('quiet-end');
            if (Boolean(start) !== Boolean(end) || (clear && (start || end))) throw new Error('invalid-follow-settings');
            const settings = {
                timezone: interaction.options.getString('timezone') ?? saved.timezone,
                quietStart: clear ? null : start ?? saved.quietStart,
                quietEnd: clear ? null : end ?? saved.quietEnd,
                digestAt: interaction.options.getString('digest-at') ?? saved.digestAt,
            };
            await manager.configure(userId, settings);
            await interaction.editReply({ content: t('settings', { timezone: settings.timezone, digest: settings.digestAt, quiet: settings.quietStart ? `${settings.quietStart}–${settings.quietEnd}` : t('off') }), allowedMentions: { parse: [] } }); return;
        }
        if (action === 'pause' || action === 'resume' || action === 'remove') {
            const changed = await manager.change(userId, interaction.options.getString('id', true), action);
            await interaction.editReply({ content: changed ? t('updated') : t('missing') });
        }
    } catch {
        await interaction.editReply({ content: t('failed'), allowedMentions: { parse: [] } });
    }
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'game') {
        try {
            const games = await searchSteamApps(String(focused.value), { limit: 20 });
            await interaction.respond(games.map(game => ({ name: `${game.appName} (${game.steamAppId})`.slice(0, 100), value: String(game.steamAppId) })));
        } catch { await interaction.respond([]); }
        return;
    }
    const query = String(focused.value).toLowerCase();
    const records = await getConfigManager().userFollowManager.list(interaction.user.id);
    await interaction.respond(records.filter(value => value.label.toLowerCase().includes(query) || value.id.startsWith(query)).slice(0, 25).map(value => ({ name: `${value.label} (${value.provider})`.slice(0, 100), value: value.id })));
}

export default { data, execute, autocomplete };
