import {db} from './db.js';
import {BirthdayConfig} from '../types/birthdayConfig.js';

export class BirthdayManager {
    async addBirthday(birthday: BirthdayConfig) {
        db.data!.birthdays ||= [];
        db.data!.birthdays.push(birthday);
        await db.write();
    }

    async hasBirthday({userId, channelId}: { userId: string; channelId: string }): Promise<boolean> {
        db.data!.birthdays ||= [];
        return db.data!.birthdays.some(
            b => b.userId === userId && b.channelId === channelId
        );
    }

    getBirthdays(): BirthdayConfig[] {
        db.data!.birthdays ||= [];
        return db.data!.birthdays;
    }
}