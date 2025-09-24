import {SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags} from 'discord.js';
import {configManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';
import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {resolveLeagueIdentity} from '../../../services/riotService.js';
import {getRegionCodeFromName} from '../utils/leagueUtils.js';
import {LeagueConfig} from '@zeffuro/fakegaming-common/dist/models/league-config.js';

/**
 * Slash command metadata for Discord registration.
 */
const data = new SlashCommandBuilder()
    .setName('link-riot')
    .setDescription('Link your Discord account or another user to a Riot account')
    .addStringOption(option =>
        option.setName('riot-id')
            .setDescription('Riot ID (e.g. Zeffuro#EUW)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('region')
            .setDescription('Region')
            .setRequired(true)
            .addChoices(...leagueRegionChoices)
    )
    .addUserOption(option =>
        option.setName('user')
            .setDescription('Discord user to link (admin only)')
            .setRequired(false)
    );

/**
 * Executes the link-riot command, linking a Discord user to a Riot account.
 * Handles admin permission checks and updates the user manager.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const summonerInput = interaction.options.getString('riot-id') ?? undefined;
    const regionInput = interaction.options.getString('region') ?? undefined;
    const region = getRegionCodeFromName(regionInput);
    const targetUser = interaction.options.getUser('user');
    let userId = interaction.user.id;

    if (targetUser) {
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: 'You need admin permissions to link for another user.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        userId = targetUser.id;
    }

    let identity;
    try {
        identity = await resolveLeagueIdentity({
            summoner: summonerInput,
            region,
            userId
        });
    } catch {
        await interaction.editReply('Failed to resolve Riot Account. Please check the Riot ID and region.');
        return;
    }

    // Fetch user with league relation
    let user = await configManager.userManager.getUserWithLeague(userId);

    if (user) {
        if (user.league) {
            // Update existing LeagueConfig
            await user.league.update({
                summonerName: identity.summoner,
                region: identity.region,
                puuid: identity.puuid
            });
        } else {
            // Create new LeagueConfig
            await LeagueConfig.create({
                discordId: userId,
                summonerName: identity.summoner,
                region: identity.region,
                puuid: identity.puuid
            });
        }
    } else {
        // Create UserConfig and LeagueConfig
        user = await configManager.userManager.add({discordId: userId});
        await LeagueConfig.create({
            discordId: userId,
            summonerName: identity.summoner,
            region: identity.region,
            puuid: identity.puuid
        });
    }
    await interaction.editReply(`Linked <@${userId}> to Riot ID: ${identity.summoner} [${identity.region}]`);
}

const testOnly = false;

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};