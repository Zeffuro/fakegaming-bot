import { runtimeText } from '../../../core/runtimeCopy.js';
import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    AutocompleteInteraction,
    PermissionFlagsBits
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {requireAdmin} from "../../../utils/permissions.js";
import {gameAutocomplete} from "../shared/gameAutocomplete.js";
import {buildPatchNoteEmbed} from "../shared/patchNoteEmbed.js";
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { subscribePatchnotes as META } from '../commands.manifest.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('game').setDescription('Game to subscribe to').setRequired(true).setAutocomplete(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel to receive patch notes').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    if (!(await requireAdmin(interaction))) return;
    const game = interaction.options.getString('game', true);
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId!;

    await getConfigManager().patchSubscriptionManager.subscribe(game, channel.id, guildId);

    const latestPatch = await getConfigManager().patchNotesManager.getLatestPatch(game);
    if (latestPatch) {
        await interaction.reply({
            content: runtimeText(locale, 'patchnotes', 'subscribedToPatchNotesForLatestPatch', {channelId: channel.id, game}),
            embeds: [resolveLocaleValue(locale, { en: buildPatchNoteEmbed(latestPatch), nl: buildPatchNoteEmbed(latestPatch, locale) })]
        });
    } else {
        await interaction.reply(runtimeText(locale, 'patchnotes', 'subscribedToPatchNotesFor', {channelId: channel.id, game}));
    }
}

async function autocomplete(interaction: AutocompleteInteraction) {
    await gameAutocomplete(interaction);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly, autocomplete};
