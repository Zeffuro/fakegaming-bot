import {BaseManager} from './baseManager.js';
import {UserConfig} from '../models/user-config.js';
import {LeagueConfig} from "../models/league-config.js";

/**
 * Manages user configuration records and user-specific settings.
 */
export class UserManager extends BaseManager<UserConfig> {
    constructor() {
        super(UserConfig);
    }

    async getUser({discordId}: { discordId: string }): Promise<UserConfig | null> {
        return await this.model.findOne({where: {discordId}});
    }

    async getUserWithLeague(discordId: string) {
        return await this.model.findOne({
            where: {discordId},
            include: [{model: LeagueConfig}]
        });
    }

    async setUser(user: Partial<UserConfig>) {
        await this.model.upsert(user);
    }

    async setTimezone({discordId, timezone}: { discordId: string, timezone: string }) {
        await this.model.update({timezone}, {where: {discordId}});
    }

    async setDefaultReminderTimeSpan({discordId, timespan}: { discordId: string, timespan: string }) {
        await this.model.update({defaultReminderTimeSpan: timespan}, {where: {discordId}});
    }
}