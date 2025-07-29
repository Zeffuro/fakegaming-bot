import {db} from './db.js';
import {UserConfig} from '../types/userConfig.js';

export class UserManager {
    async addUser(user: UserConfig) {
        db.data!.users.push(user);
        await db.write();
    }

    getUser(discordId: string): UserConfig | undefined {
        return db.data!.users.find(user => user.discordId === discordId);
    }

    async setUser(user: UserConfig) {
        const idx = db.data!.users.findIndex(user => user.discordId === user.discordId);
        if (idx !== -1) {
            db.data!.users[idx] = user;
        } else {
            db.data!.users.push(user);
        }
        await db.write();
    }
}