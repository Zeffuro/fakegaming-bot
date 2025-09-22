import {SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, AutocompleteInteraction} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {loadPatchNoteFetchers} from "../../../loaders/loadPatchNoteFetchers.js";

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
    );

async function execute(interaction: ChatInputCommandInteraction) {
    const game = interaction.options.getString('game', true);
    const channel = interaction.options.getChannel('channel', true);

    await configManager.patchSubscriptionManager.subscribe(game, channel.id);

    await interaction.reply(`Subscribed <#${channel.id}> to patch notes for \`${game}\`.`);
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const fetchers = await loadPatchNoteFetchers();
    const games = fetchers.map(fetcher => fetcher.game);
    const focused = interaction.options.getFocused();
    const filtered = games.filter(game => game.toLowerCase().includes(focused.toLowerCase()));
    await interaction.respond(filtered.map(game => ({name: game, value: game})));
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, autocomplete};