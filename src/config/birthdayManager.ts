import {db} from './db.js';
import {BirthdayConfig} from '../types/birthdayConfig.js';

export class BirthdayManager {
    async addBirthday(birthday: BirthdayConfig) {
        db.data!.birthdays ||= [];
        db.data!.birthdays.push(birthday);
        await db.write();
    }

    async hasBirthday({userId, guildId}: { userId: string; guildId: string }): Promise<boolean> {
        return !!this.getBirthday({userId, guildId});
    }

    getBirthday({userId, guildId}: { userId: string; guildId: string }): BirthdayConfig | undefined {
        db.data!.birthdays ||= [];
        return db.data!.birthdays.find(
            birthday => birthday.userId === userId && birthday.guildId === guildId
        );
    }

    getBirthdays(): BirthdayConfig[] {
        db.data!.birthdays ||= [];
        return db.data!.birthdays;
    }

    async removeBirthday({userId, guildId}: { userId: string, guildId: string }) {
        db.data!.birthdays = db.data!.birthdays.filter(
            birthday => !(birthday.userId === userId && birthday.guildId === guildId)
        );
        await db.write();
    }
}