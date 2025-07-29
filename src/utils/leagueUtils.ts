import {ChatInputCommandInteraction} from 'discord.js';
import {resolveLeagueIdentity} from '../services/riotService.js';
import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {Regions} from 'twisted/dist/constants/regions.js';

export async function getLeagueIdentityFromInteraction(
    interaction: ChatInputCommandInteraction,
) {
    const summoner = interaction.options.getString('riot-id') ?? undefined;
    const regionInput = interaction.options.getString('region') ?? undefined;
    const region = getRegionCodeFromName(regionInput);
    const user = interaction.options.getUser('user');
    const userId = user ? user.id : interaction.user.id;

    return await resolveLeagueIdentity({
        summoner,
        region,
        userId
    });
}

export function getRegionCodeFromName(regionInput?: string): Regions | undefined {
    if (!regionInput) return undefined;
    // Try to match by name
    let regionObj = leagueRegionChoices.find(region => region.name === regionInput);
    if (regionObj) return regionObj.value as Regions;
    // Try to match by code
    regionObj = leagueRegionChoices.find(region => region.value === regionInput);
    if (regionObj) return regionObj.value as Regions;
    return undefined;
}