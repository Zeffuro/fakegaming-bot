import {BaseManager} from './baseManager.js';
import {UserConfig} from '../types/userConfig.js';

export class UserManager extends BaseManager<UserConfig> {
    constructor() {
        super('users');
    }

    getUser({discordId}: { discordId: string }): UserConfig | undefined {
        return this.collection.find(user => user.discordId === discordId);
    }

    async setUser(user: UserConfig) {
        const idx = this.collection.findIndex(u => u.discordId === user.discordId);
        if (idx !== -1) {
            this.collection[idx] = user;
        } else {
            this.collection.push(user);
        }
        await this.setAll(this.collection);
    }

    async setTimezone({discordId, timezone}: { discordId: string, timezone: string }) {
        const user = this.getUser({discordId});
        if (user) {
            user.timezone = timezone;
            await this.setUser(user);
        }
    }

    async setDefaultReminderTimeSpan({discordId, timespan}: { discordId: string, timespan: string }) {
        const user = this.getUser({discordId});
        if (user) {
            user.defaultReminderTimeSpan = timespan;
            await this.setUser(user);
        }
    }
}