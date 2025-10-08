import { BaseManager } from './baseManager.js';
import { BirthdayConfig } from '../models/birthday-config.js';

export class BirthdayManager extends BaseManager<BirthdayConfig> {
    constructor() {
        super(BirthdayConfig);
    }

    /** Get a birthday, returns plain object or null */
    async getBirthday(userId: string, guildId: string) {
        const row = await this.getOne({ userId, guildId }, { raw: true });
        return row ?? null;
    }

    /** Check if a birthday exists */
    async hasBirthday(userId: string, guildId: string) {
        return await this.exists({ userId, guildId });
    }

    /** Remove a birthday */
    async removeBirthday(userId: string, guildId: string) {
        await this.remove({ userId, guildId });
    }

    /** Get all birthdays as plain objects */
    async getAllPlain(): Promise<{ day: number; month: number; year?: number; userId: string; channelId: string }[]> {
        return await this.getAll({ raw: true }) as any;
    }

    /** Helper: Is it the birthday today (with Feb 29 handling) */
    isBirthdayToday(birthday: { day: number; month: number }, today = new Date()): boolean {
        const day = today.getDate();
        const month = today.getMonth() + 1;
        if (birthday.day === day && birthday.month === month) return true;

        // Feb 29 on non-leap years
        const isLeapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        return !isLeapYear(today.getFullYear()) && birthday.day === 29 && birthday.month === 2 && day === 28 && month === 2;
    }
}
