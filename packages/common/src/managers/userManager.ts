import { BaseManager } from './baseManager.js';
import { UserConfig } from '../models/user-config.js';
import { LeagueConfig } from '../models/league-config.js';

export class UserManager extends BaseManager<UserConfig> {
    constructor() {
        super(UserConfig);
    }

    // Returns the UserConfig instance (Sequelize model)
    async getUser({ discordId }: { discordId: string }): Promise<UserConfig | null> {
        return await this.getOne({ discordId }) ?? null;
    }

    // Returns the UserConfig instance with LeagueConfig included
    async getUserWithLeague(discordId: string): Promise<UserConfig | null> {
        return await this.model.findOne({
            where: { discordId },
            include: [{ model: LeagueConfig }]
        });
    }

    // Save or update a user using Sequelize instance methods
    async setUser(user: Partial<UserConfig>) {
        const instance = await this.getOne({ discordId: user.discordId });
        if (instance) {
            await instance.update(user);
        } else {
            await this.model.create(user);
        }
    }

    async setTimezone({ discordId, timezone }: { discordId: string; timezone: string }) {
        const instance = await this.getOne({ discordId });
        if (instance) {
            await instance.update({ timezone });
        }
    }

    async setDefaultReminderTimeSpan({ discordId, timespan }: { discordId: string; timespan: string }) {
        const instance = await this.getOne({ discordId });
        if (instance) {
            await instance.update({ defaultReminderTimeSpan: timespan });
        }
    }
}
