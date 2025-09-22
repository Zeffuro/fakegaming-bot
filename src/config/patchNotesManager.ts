import {BaseManager} from './baseManager.js';
import {PatchNoteConfig} from '../types/patchNoteConfig.js';
import {PatchSubscriptionConfig} from '../types/patchSubscriptionConfig.js';

export class PatchNotesManager extends BaseManager<PatchNoteConfig> {
    constructor() {
        super('patchNotes');
    }

    getLatestPatch(game: string): PatchNoteConfig | undefined {
        return this.collection
            .filter(note => note.game === game)
            .sort((a, b) => b.publishedAt - a.publishedAt)[0];
    }

    async setLatestPatch(note: PatchNoteConfig) {
        const filtered = this.collection.filter(n => n.game !== note.game);
        filtered.push(note);
        await this.setAll(filtered);
    }
}

export class PatchSubscriptionManager extends BaseManager<PatchSubscriptionConfig> {
    constructor() {
        super('patchSubscriptions');
    }

    getSubscriptions(game: string): string[] {
        return this.collection
            .filter(sub => sub.game === game)
            .map(sub => sub.channelId);
    }

    async subscribe(game: string, channelId: string) {
        if (!this.collection.find(sub => sub.game === game && sub.channelId === channelId)) {
            this.collection.push({game, channelId});
            await this.setAll(this.collection);
        }
    }
}