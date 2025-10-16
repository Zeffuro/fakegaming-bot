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

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('game').setDescription('Game to subscribe to').setRequired(true).setAutocomplete(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel to receive patch notes').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
);

async function execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireAdmin(interaction))) return;
    const game = interaction.options.getString('game', true);
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId!;

    await getConfigManager().patchSubscriptionManager.subscribe(game, channel.id, guildId);

    const latestPatch = await getConfigManager().patchNotesManager.getLatestPatch(game);
    if (latestPatch) {
        await interaction.reply({
            content: `Subscribed <#${channel.id}> to patch notes for \`${game}\`. Latest patch:`,
            embeds: [buildPatchNoteEmbed(latestPatch)]
        });
    } else {
        await interaction.reply(`Subscribed <#${channel.id}> to patch notes for \`${game}\`.`);
    }
}

async function autocomplete(interaction: AutocompleteInteraction) {
    await gameAutocomplete(interaction);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly, autocomplete};