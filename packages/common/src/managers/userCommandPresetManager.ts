import { randomUUID } from 'node:crypto';
import { UserCommandPreset } from '../models/user-command-preset.js';
import { serializedTransaction } from './serializedTransaction.js';

export class UserCommandPresetManager {
    async list(userId: string): Promise<UserCommandPreset[]> {
        return UserCommandPreset.findAll({ where: { userId }, order: [['name', 'ASC']] });
    }

    async get(userId: string, name: string): Promise<UserCommandPreset | null> {
        return UserCommandPreset.findOne({ where: { userId, name: this.name(name) } });
    }

    async save(userId: string, name: string, commandPath: string, args: Record<string, string>): Promise<UserCommandPreset> {
        const normalized = this.name(name);
        if (!userId || !normalized || normalized.length > 40 || commandPath.length > 100 || !commandPath
            || JSON.stringify(args).length > 2000) throw new Error('invalid-preset');
        return serializedTransaction(UserCommandPreset.sequelize!, async transaction => {
            const existing = await UserCommandPreset.findOne({ where: { userId, name: normalized }, transaction });
            if (existing) return existing.update({ commandPath, argumentsJson: JSON.stringify(args) }, { transaction });
            if (await UserCommandPreset.count({ where: { userId }, transaction }) >= 50) throw new Error('preset-capacity');
            return UserCommandPreset.create({ id: randomUUID(), userId, name: normalized, commandPath, argumentsJson: JSON.stringify(args) }, { transaction });
        });
    }

    async remove(userId: string, name: string): Promise<boolean> {
        return await UserCommandPreset.destroy({ where: { userId, name: this.name(name) } }) === 1;
    }

    private name(name: string): string { return name.normalize('NFKC').trim().toLowerCase(); }
}
