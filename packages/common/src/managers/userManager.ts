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
        return (await this.getOne({discordId}))?.get() ?? null;
    }

    async getUserWithLeague(discordId: string): Promise<UserConfig | null> {
        const user = await this.model.findOne({
            where: {discordId},
            include: [{model: LeagueConfig}]
        });
        return user?.get({plain: true}) ?? null;
    }

    async setUser(user: Partial<UserConfig>) {
        await this.set(user, 'discordId');
    }

    async setTimezone({discordId, timezone}: { discordId: string, timezone: string }) {
        await this.update({timezone}, {discordId});
    }

    async setDefaultReminderTimeSpan({discordId, timespan}: { discordId: string, timespan: string }) {
        await this.update({defaultReminderTimeSpan: timespan}, {discordId});
    }
}