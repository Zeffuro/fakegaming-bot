import {BaseManager} from './baseManager.js';
import {PatchNoteConfig} from '../models/patch-note-config.js';
import {PatchSubscriptionConfig} from '../models/patch-subscription-config.js';
import type { CreationAttributes } from 'sequelize';

export class PatchNotesManager extends BaseManager<PatchNoteConfig> {
    constructor() {
        super(PatchNoteConfig);
    }

    async getLatestPatch(game: string): Promise<PatchNoteConfig | null> {
        return this.getOne({ game });
    }

    async setLatestPatch(patch: Partial<PatchNoteConfig> | PatchNoteConfig) {
        const data = patch instanceof PatchNoteConfig ? patch.get({ plain: true }) : patch;
        await this.upsert(data, ['game']);
    }
}


export class PatchSubscriptionManager extends BaseManager<PatchSubscriptionConfig> {
    constructor() {
        super(PatchSubscriptionConfig);
    }

    async subscribe(game: string, channelId: string, guildId: string) {
        await this.findOrCreate({ where: { game, channelId, guildId } });
    }

    async getSubscriptionsForGame(game: string): Promise<PatchSubscriptionConfig[]> {
        return this.getMany({ game });
    }

    async upsertSubscription(sub: Partial<PatchSubscriptionConfig> | PatchSubscriptionConfig) {
        const data = sub instanceof PatchSubscriptionConfig ? sub.get({ plain: true }) : sub;
        await this.upsert(data, ['game', 'channelId']);
    }

    // Normalize lastAnnouncedAt before persisting to ensure consistent BIGINT storage
    async upsert(item: CreationAttributes<PatchSubscriptionConfig> | PatchSubscriptionConfig, conflictFields?: string[]): Promise<boolean> {
        const raw = item instanceof PatchSubscriptionConfig ? item.get({ plain: true }) : { ...item } as CreationAttributes<PatchSubscriptionConfig> & { [k: string]: unknown };
        const la = (raw as { lastAnnouncedAt?: unknown }).lastAnnouncedAt;
        if (la instanceof Date) {
            (raw as { lastAnnouncedAt?: number }).lastAnnouncedAt = la.getTime();
        }
        return super.upsert(raw as CreationAttributes<PatchSubscriptionConfig>, conflictFields);
    }
}
