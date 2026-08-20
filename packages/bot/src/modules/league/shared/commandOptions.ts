import { SlashCommandBuilder } from 'discord.js';
import { leagueRegionChoices } from '../constants/leagueRegions.js';

/**
 * Adds common League command options: Riot ID, region, and user.
 */
export function buildCommonLeagueOptions<T extends SlashCommandBuilder>(builder: T): T {
    builder
        .addStringOption(option =>
            option.setName('riot-id')
                .setNameLocalization('nl', 'riot-id')
                .setDescription('Riot ID, including tag (for example Name#TAG)')
                .setDescriptionLocalization('nl', 'Riot ID inclusief tag (bijvoorbeeld Naam#TAG)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('region')
                .setNameLocalization('nl', 'regio')
                .setDescription('Region')
                .setDescriptionLocalization('nl', 'Regio')
                .setRequired(false)
                .addChoices(...leagueRegionChoices)
        )
        .addUserOption(option =>
            option.setName('user')
                .setNameLocalization('nl', 'gebruiker')
                .setDescription('Discord user')
                .setDescriptionLocalization('nl', 'Discord-gebruiker')
                .setRequired(false)
        );
    return builder;
}

