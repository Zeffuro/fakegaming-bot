import { BaseManager } from './baseManager.js';
import { BlueskyPostConfig } from '../models/bluesky-post-config.js';

export class BlueskyManager extends BaseManager<BlueskyPostConfig> {
    constructor() {
        super(BlueskyPostConfig);
    }

    async getAllAccounts() {
        return await this.model.findAll();
    }

    async accountExists(blueskyHandle: string, discordChannelId: string, guildId: string) {
        const existing = await this.getOne(
            { blueskyHandle, discordChannelId, guildId },
            { raw: true }
        );
        return !!existing;
    }

    async upsertAccount(data: Partial<BlueskyPostConfig> & {
        blueskyHandle: string;
        discordChannelId: string;
        guildId: string;
    }) {
        const created = await this.upsert(data, ['guildId', 'blueskyHandle']);
        const record = await this.getOne(
            { blueskyHandle: data.blueskyHandle, discordChannelId: data.discordChannelId, guildId: data.guildId },
            { raw: true }
        );
        return { record, created };
    }

    async removeAccount(blueskyHandle: string, discordChannelId: string, guildId: string) {
        await this.remove({ blueskyHandle, discordChannelId, guildId });
    }
}
