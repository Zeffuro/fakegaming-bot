import {BaseManager} from './baseManager.js';
import {PatchNoteConfig} from '../models/patch-note-config.js';
import {PatchSubscriptionConfig} from '../models/patch-subscription-config.js';

export class PatchNotesManager extends BaseManager<PatchNoteConfig> {
    constructor() {
        super(PatchNoteConfig);
    }

    async getLatestPatch(game: string): Promise<PatchNoteConfig | null> {
        return (await this.getOne({game}))?.get() ?? null;
    }

    // Manual upsert for SQLite compatibility
    async setLatestPatch(note: Partial<PatchNoteConfig>) {
        console.log('setLatestPatch called with:', note);
        const existing = await this.model.findOne({where: {game: note.game}});
        console.log('Existing row for game', note.game, ':', existing?.toJSON?.() ?? null);
        if (existing) {
            await existing.update(note);
        } else {
            await this.model.create(note);
        }
    }

    // Utility for tests: force truncate table
    async forceTruncate() {
        const sequelize = this.model.sequelize;
        if (!sequelize) throw new Error('No sequelize instance');
        if (process.env.NODE_ENV === 'test') {
            // Use Sequelize sync to drop and recreate the table to match the model
            await this.model.sync({force: true});
        } else {
            // Use safe truncate for non-test environments
            await sequelize.query('DELETE FROM PatchNoteConfigs;');
            await sequelize.query('DELETE FROM sqlite_sequence WHERE name = "PatchNoteConfigs";');
            await sequelize.query('VACUUM;');
        }
    }

    // Public getter for sequelize instance (for test/debug only)
    getSequelize() {
        return this.model.sequelize;
    }
}

export class PatchSubscriptionManager extends BaseManager<PatchSubscriptionConfig> {
    constructor() {
        super(PatchSubscriptionConfig);
    }

    async subscribe(game: string, channelId: string, guildId: string) {
        await this.findOrCreate({where: {game, channelId, guildId}});
    }

    async upsertSubscription(sub: Partial<PatchSubscriptionConfig>) {
        await this.model.upsert(sub, {conflictFields: ['game', 'channelId', 'guildId']});
    }
}