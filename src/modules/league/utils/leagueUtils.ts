import {ChatInputCommandInteraction} from 'discord.js';
import {resolveLeagueIdentity} from '../../../services/riotService.js';
import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {Regions} from 'twisted/dist/constants/regions.js';

/**
 * Resolves a League identity from a Discord interaction's options.
 * @param interaction The Discord interaction containing user and region info.
 * @returns The resolved League identity.
 */
export async function getLeagueIdentityFromInteraction(
    interaction: ChatInputCommandInteraction,
) {
    const summoner = interaction.options.getString('riot-id') ?? interaction.options.getString('summoner') ?? undefined;
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

/**
 * Gets the region code from a region name or code string.
 * @param regionInput The region name or code.
 * @returns The region code, or undefined if not found.
 */
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