import { BaseManager } from './baseManager.js';
import { UserConfig } from '../models/user-config.js';
import { LeagueConfig } from "../models/league-config.js";
/**
 * Manages user configuration records and user-specific settings.
 */
export class UserManager extends BaseManager {
    constructor() {
        super(UserConfig);
    }
    async getUser({ discordId }) {
        return await this.getOne({ discordId });
    }
    async getUserWithLeague(discordId) {
        return await this.model.findOne({
            where: { discordId },
            include: [{ model: LeagueConfig }]
        });
    }
    async setUser(user) {
        await this.set(user, 'discordId');
    }
    async setTimezone({ discordId, timezone }) {
        await this.update({ timezone }, { discordId });
    }
    async setDefaultReminderTimeSpan({ discordId, timespan }) {
        await this.update({ defaultReminderTimeSpan: timespan }, { discordId });
    }
}
