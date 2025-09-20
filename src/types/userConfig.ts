import {LeagueConfig} from './leagueConfig.js';

/**
 * Configuration for a Discord user.
 * - discordId: The user's Discord ID.
 * - league: The user's League of Legends configuration (optional).
 * - timezone: The user's timezone (optional).
 * - defaultReminderTimeSpan: The user's default reminder timespan (optional).
 */
export type UserConfig = {
    discordId: string;
    league?: LeagueConfig;
    timezone?: string;
    defaultReminderTimeSpan?: string;
};