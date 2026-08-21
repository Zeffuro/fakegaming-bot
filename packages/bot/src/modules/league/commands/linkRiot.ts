import { runtimeText } from '../../../core/runtimeCopy.js';
import {SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {leagueRegionChoices} from '../constants/leagueRegions.js';
import {resolveLeagueIdentity} from '../../../services/riotService.js';
import {getRegionCodeFromName} from '../utils/leagueUtils.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { linkRiot as META } from '../commands.manifest.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { leagueText } from '../copy/leagueCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('riot-id').setDescription('Riot ID (e.g. Zeffuro#EUW)').setRequired(true))
        .addStringOption(option => option.setName('region').setDescription('Region').setRequired(true).addChoices(...leagueRegionChoices))
        .addUserOption(option => option.setName('user').setDescription('Discord user to link (admin only)').setRequired(false))
);

/**
 * Executes the link-riot command, linking a Discord user to a Riot account.
 * Handles admin permission checks and updates the user manager.
 * Replies with a confirmation or error message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    await interaction.deferReply();

    const summonerInput = interaction.options.getString('riot-id') ?? undefined;
    const regionInput = interaction.options.getString('region') ?? undefined;
    const region = getRegionCodeFromName(regionInput);
    const targetUser = interaction.options.getUser('user');
    let userId = interaction.user.id;

    if (targetUser) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.editReply(leagueText(locale, "youNeedAdminPermissionsToLinkForAnother"));
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
        await interaction.editReply(leagueText(locale, "failedToResolveRiotAccountPleaseCheckThe2"));
        return;
    }

    await getConfigManager().leagueManager.setLinkedAccount({
        discordId: userId,
        summonerName: identity.summoner,
        region: identity.region,
        puuid: identity.puuid,
    });
    await interaction.editReply(runtimeText(locale, 'league', 'linkedToRiotId', {
        userId, riotId: identity.summoner, region: identity.region,
    }));
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
