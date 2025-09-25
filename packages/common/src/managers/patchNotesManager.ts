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

    // Simplified to use the new upsert method in BaseManager
    async setLatestPatch(note: Partial<PatchNoteConfig>) {
        await this.upsert(note);
    }
}

export class PatchSubscriptionManager extends BaseManager<PatchSubscriptionConfig> {
    constructor() {
        super(PatchSubscriptionConfig);
    }

    async subscribe(game: string, channelId: string) {
        await this.findOrCreate({where: {game, channelId}});
    }

    async upsertSubscription(sub: Partial<PatchSubscriptionConfig>) {
        await this.model.upsert(sub, {conflictFields: ['game', 'channelId']});
    }
}