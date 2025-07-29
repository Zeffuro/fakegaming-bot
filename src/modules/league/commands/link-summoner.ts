// @ts-ignore
import {SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {leagueRegionChoices} from '../../../constants/leagueRegions.js';
import {resolveLeagueIdentity} from '../../../services/riotService.js';
import {getRegionCodeFromName} from '../../../utils/leagueUtils.js';

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

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
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
    } catch (error) {
        await interaction.editReply('Failed to resolve Riot Account. Please check the Riot ID and region.');
        return;
    }

    let user = configManager.userManager.getUser(userId);
    if (user) {
        user.league = {summonerName: identity.summoner, region: identity.region, puuid: identity.puuid};
        await configManager.userManager.setUser(user);
    } else {
        user = {
            discordId: userId,
            league: {summonerName: identity.summoner, region: identity.region, puuid: identity.puuid}
        };
        await configManager.userManager.addUser(user);
    }
    await interaction.editReply(`Linked <@${userId}> to Riot ID: ${identity.summoner} [${identity.region}]`);
}

export {data};