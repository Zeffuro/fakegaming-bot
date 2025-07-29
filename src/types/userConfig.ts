import { LeagueConfig } from './leagueConfig';

export type UserConfig = {
  discordId: string;
  league?: LeagueConfig;
};