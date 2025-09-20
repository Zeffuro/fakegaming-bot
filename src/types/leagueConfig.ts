/**
 * Configuration for a League of Legends account.
 * - summonerName: The summoner's name.
 * - region: The region of the account.
 * - puuid: The player's unique universal identifier.
 */
export type LeagueConfig = {
    summonerName: string;
    region: string;
    puuid: string;
};