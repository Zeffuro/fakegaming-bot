import { BaseManager } from './baseManager.js';
import { PatchNoteConfig } from '../models/patch-note-config.js';
import { PatchSubscriptionConfig } from '../models/patch-subscription-config.js';
export class PatchNotesManager extends BaseManager {
    constructor() {
        super(PatchNoteConfig);
    }
    async getLatestPatch(game) {
        return await this.getOne({ game });
    }
    // Simplified to use the new upsert method in BaseManager
    async setLatestPatch(note) {
        await this.upsert(note);
    }
}
export class PatchSubscriptionManager extends BaseManager {
    constructor() {
        super(PatchSubscriptionConfig);
    }
    async getSubscriptions(game) {
        const subs = await this.getMany({ game });
        return subs.map(sub => sub.channelId);
    }
    // Simplified to use the new findOrCreate method in BaseManager
    async subscribe(game, channelId) {
        await this.findOrCreate({ where: { game, channelId } });
    }
}
