import {BaseManager} from './baseManager.js';
import {BirthdayConfig} from '../models/birthday-config.js';

/**
 * Manages birthday records for users in guilds.
 */
export class BirthdayManager extends BaseManager<BirthdayConfig> {
    constructor() {
        super(BirthdayConfig);
    }

    async hasBirthday({userId, guildId}: { userId: string; guildId: string }): Promise<boolean> {
        const record = await this.getBirthday({userId, guildId});
        return !!record;
    }

    async getBirthday({userId, guildId}: { userId: string; guildId: string }): Promise<BirthdayConfig | null> {
        return await this.getOne({userId, guildId});
    }

    async removeBirthday({userId, guildId}: { userId: string, guildId: string }) {
        await this.remove({userId, guildId});
    }
}