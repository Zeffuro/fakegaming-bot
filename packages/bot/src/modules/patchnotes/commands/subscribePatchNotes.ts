import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    AutocompleteInteraction,
    PermissionFlagsBits
} from 'discord.js';
import {configManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';
import {requireAdmin} from "../../../utils/permissions.js";
import {gameAutocomplete} from "../shared/gameAutocomplete.js";
import {buildPatchNoteEmbed} from "../shared/patchNoteEmbed.js";

const data = new SlashCommandBuilder()
    .setName('subscribe-patchnotes')
    .setDescription('Subscribe a channel to patch notes for a game')
    .addStringOption(option =>
        option.setName('game')
            .setDescription('Game to subscribe to')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Channel to receive patch notes')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireAdmin(interaction))) return;
    const game = interaction.options.getString('game', true);
    const channel = interaction.options.getChannel('channel', true);

    await configManager.patchSubscriptionManager.subscribe(game, channel.id);

    const latestPatch = await configManager.patchNotesManager.getLatestPatch(game);
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

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly, autocomplete};