import { SlashCommandBuilder } from 'discord.js';
import { leagueRegionChoices } from '../constants/leagueRegions.js';

/**
 * Adds common League command options: summoner, region, and user.
 */
export function buildCommonLeagueOptions<T extends SlashCommandBuilder>(builder: T): T {
    builder
        .addStringOption(option =>
            option.setName('summoner')
                .setDescription('Riot ID (e.g. Name#TAG) or Summoner')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('region')
                .setDescription('Region')
                .setRequired(false)
                .addChoices(...leagueRegionChoices)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user')
                .setRequired(false)
        );
    return builder;
}

