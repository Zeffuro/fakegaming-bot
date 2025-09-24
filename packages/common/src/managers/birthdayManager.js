import { BaseManager } from './baseManager.js';
import { BirthdayConfig } from '../models/birthday-config.js';
/**
 * Manages birthday records for users in guilds.
 */
export class BirthdayManager extends BaseManager {
    constructor() {
        super(BirthdayConfig);
    }
    async hasBirthday({ userId, guildId }) {
        const record = await this.getBirthday({ userId, guildId });
        return !!record;
    }
    async getBirthday({ userId, guildId }) {
        return await this.getOne({ userId, guildId });
    }
    async removeBirthday({ userId, guildId }) {
        await this.remove({ userId, guildId });
    }
}
