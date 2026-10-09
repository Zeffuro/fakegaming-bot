import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import { createBotTranslator, resolveInteractionOutputLocale, resolveLocaleValue, type OutputLocaleValues, type BotMessages } from '../../../core/localization.js';
import type { FakegamingBot } from '../../../core/FakegamingBot.js';
import { preset as META } from '../commands.manifest.js';
import { parsePresetArguments, PRESET_COMMANDS, presetInteraction, validatePreset } from '../shared/presetExecution.js';
import en from '../../../messages/en/presets.json' with { type: 'json' };
import nl from '../../../messages/nl/presets.json' with { type: 'json' };

const data = createSlashCommand(META, builder => builder
    .addSubcommand(sub => sub.setName('save').setDescription('Save or replace a command preset')
        .addStringOption(option => option.setName('name').setDescription('Your preset name').setMaxLength(40).setRequired(true))
        .addStringOption(option => option.setName('command').setDescription('Command to save').setRequired(true).addChoices(...PRESET_COMMANDS.map(value => ({ name: value, value }))))
        .addStringOption(option => option.setName('options').setDescription('Saved options, e.g. location:Amsterdam or game:valorant').setMaxLength(2000)))
    .addSubcommand(sub => sub.setName('run').setDescription('Run a saved preset')
        .addStringOption(option => option.setName('name').setDescription('Your preset name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List your saved presets')
        .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a saved preset')
        .addStringOption(option => option.setName('name').setDescription('Your preset name').setRequired(true).setAutocomplete(true))));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = await resolveInteractionOutputLocale({ guildId: null, user: interaction.user, locale: interaction.locale });
    const t = createBotTranslator(locale, resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<BotMessages>));
    const cm = getConfigManager();
    const manager = cm.userCommandPresetManager;
    const userId = interaction.user.id;
    const action = interaction.options.getSubcommand(true);
    const name = interaction.options.getString('name') ?? '';
    try {
        if (action === 'list') {
            const presets = await manager.list(userId);
            const page = interaction.options.getInteger('page') ?? 1;
            const lines = presets.slice((page - 1) * 10, page * 10).map(value => `**${value.name}** — /${value.commandPath}`).join('\n');
            await interaction.editReply({ content: lines ? `${t('title')} ${page}/${Math.ceil(presets.length / 10)}\n${lines}` : t('empty'), allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'delete') {
            await interaction.editReply({ content: await manager.remove(userId, name) ? t('deleted') : t('missing') });
            return;
        }
        const saved = action === 'run' ? await manager.get(userId, name) : null;
        if (action === 'run' && !saved) { await interaction.editReply({ content: t('missing') }); return; }
        const path = saved?.commandPath ?? interaction.options.getString('command', true);
        const args = saved ? JSON.parse(saved.argumentsJson) as Record<string, string> : parsePresetArguments(interaction.options.getString('options') ?? '');
        const commands = (interaction.client as FakegamingBot).commands;
        const target = commands.get(path.split(' ')[0]!);
        if (!target) throw new Error('unsupported-preset-command');
        const values = validatePreset(target, path, args);
        if (action === 'save') {
            await manager.save(userId, name, path, args);
            await interaction.editReply({ content: t('saved'), allowedMentions: { parse: [] } });
            return;
        }
        if (interaction.guildId && (await cm.disabledCommandManager.isCommandDisabled(interaction.guildId, target.data.name)
            || (target.moduleName && await cm.disabledModuleManager.isModuleDisabled(interaction.guildId, target.moduleName)))) {
            await interaction.editReply({ content: t('disabled') }); return;
        }
        await target.execute(presetInteraction(interaction, path, values));
    } catch {
        await interaction.editReply({ content: t('invalid'), allowedMentions: { parse: [] } });
    }
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const query = String(interaction.options.getFocused()).toLowerCase();
    const presets = await getConfigManager().userCommandPresetManager.list(interaction.user.id);
    await interaction.respond(presets.filter(value => value.name.includes(query)).slice(0, 25).map(value => ({ name: value.name, value: value.name })));
}

export default { data, execute, autocomplete };
