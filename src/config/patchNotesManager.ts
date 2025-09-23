import {BaseManager} from './baseManager.js';
import {PatchNoteConfig} from '../models/patch-note-config.js';
import {PatchSubscriptionConfig} from '../models/patch-subscription-config.js';

export class PatchNotesManager extends BaseManager<PatchNoteConfig> {
    constructor() {
        super(PatchNoteConfig);
    }

    async getLatestPatch(game: string): Promise<PatchNoteConfig | null> {
        return await this.model.findOne({
            where: {game},
            order: [['publishedAt', 'DESC']]
        });
    }

    async setLatestPatch(note: Partial<PatchNoteConfig>) {
        await this.model.upsert(note);
    }
}

export class PatchSubscriptionManager extends BaseManager<PatchSubscriptionConfig> {
    constructor() {
        super(PatchSubscriptionConfig);
    }

    async getSubscriptions(game: string): Promise<string[]> {
        const subs = await this.model.findAll({where: {game}});
        return subs.map(sub => sub.channelId);
    }

    async subscribe(game: string, channelId: string) {
        await this.model.findOrCreate({where: {game, channelId}});
    }
}