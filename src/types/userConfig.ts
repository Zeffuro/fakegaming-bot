import {LeagueConfig} from './leagueConfig.js';

export type UserConfig = {
    discordId: string;
    league?: LeagueConfig;
};