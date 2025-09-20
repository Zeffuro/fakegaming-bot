import {BaseManager} from './baseManager.js';
import {UserConfig} from '../types/userConfig.js';

/**
 * Manages user configuration records and user-specific settings.
 */
export class UserManager extends BaseManager<UserConfig> {
    /**
     * Creates a new UserManager.
     */
    constructor() {
        super('users');
    }

    /**
     * Gets a user configuration by Discord ID.
     * @param discordId The user's Discord ID.
     * @returns The user configuration, or undefined if not found.
     */
    getUser({discordId}: { discordId: string }): UserConfig | undefined {
        return this.collection.find(user => user.discordId === discordId);
    }

    /**
     * Sets or updates a user configuration.
     * @param user The user configuration to set.
     */
    async setUser(user: UserConfig) {
        const idx = this.collection.findIndex(u => u.discordId === user.discordId);
        if (idx !== -1) {
            this.collection[idx] = user;
        } else {
            this.collection.push(user);
        }
        await this.setAll(this.collection);
    }

    /**
     * Sets the timezone for a user.
     * @param discordId The user's Discord ID.
     * @param timezone The timezone to set.
     */
    async setTimezone({discordId, timezone}: { discordId: string, timezone: string }) {
        const user = this.getUser({discordId});
        if (user) {
            user.timezone = timezone;
            await this.setUser(user);
        }
    }

    /**
     * Sets the default reminder timespan for a user.
     * @param discordId The user's Discord ID.
     * @param timespan The default reminder timespan to set.
     */
    async setDefaultReminderTimeSpan({discordId, timespan}: { discordId: string, timespan: string }) {
        const user = this.getUser({discordId});
        if (user) {
            user.defaultReminderTimeSpan = timespan;
            await this.setUser(user);
        }
    }
}