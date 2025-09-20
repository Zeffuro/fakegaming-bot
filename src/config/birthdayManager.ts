import {BaseManager} from './baseManager.js';
import {BirthdayConfig} from '../types/birthdayConfig.js';

/**
 * Manages birthday records for users in guilds.
 */
export class BirthdayManager extends BaseManager<BirthdayConfig> {
    /**
     * Creates a new BirthdayManager.
     */
    constructor() {
        super('birthdays');
    }

    /**
     * Checks if a user has a birthday record in a guild.
     * @param userId The user's ID.
     * @param guildId The guild's ID.
     * @returns True if a birthday record exists, false otherwise.
     */
    async hasBirthday({userId, guildId}: { userId: string; guildId: string }): Promise<boolean> {
        return !!this.getBirthday({userId, guildId});
    }

    /**
     * Gets a user's birthday record in a guild.
     * @param userId The user's ID.
     * @param guildId The guild's ID.
     * @returns The birthday record, or undefined if not found.
     */
    getBirthday({userId, guildId}: { userId: string; guildId: string }): BirthdayConfig | undefined {
        return this.collection.find(
            birthday => birthday.userId === userId && birthday.guildId === guildId
        );
    }

    /**
     * Removes a user's birthday record from a guild.
     * @param userId The user's ID.
     * @param guildId The guild's ID.
     */
    async removeBirthday({userId, guildId}: { userId: string, guildId: string }) {
        const filtered = this.collection.filter(
            birthday => !(birthday.userId === userId && birthday.guildId === guildId)
        );
        await this.setAll(filtered);
    }
}