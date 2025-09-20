import {BaseManager} from './baseManager.js';
import {BirthdayConfig} from '../types/birthdayConfig.js';

export class BirthdayManager extends BaseManager<BirthdayConfig> {
    constructor() {
        super('birthdays');
    }

    async hasBirthday({userId, guildId}: { userId: string; guildId: string }): Promise<boolean> {
        return !!this.getBirthday({userId, guildId});
    }

    getBirthday({userId, guildId}: { userId: string; guildId: string }): BirthdayConfig | undefined {
        return this.collection.find(
            birthday => birthday.userId === userId && birthday.guildId === guildId
        );
    }

    async removeBirthday({userId, guildId}: { userId: string, guildId: string }) {
        const filtered = this.collection.filter(
            birthday => !(birthday.userId === userId && birthday.guildId === guildId)
        );
        await this.setAll(filtered);
    }
}