import { BaseManager } from './baseManager.js';
import { TikTokStreamConfig } from '../models/tiktok-stream-config.js';

export class TikTokManager extends BaseManager<TikTokStreamConfig> {
    constructor() {
        super(TikTokStreamConfig);
    }

    /** Get all TikTok stream configurations (plain objects for services) */
    async getAllStreams() {
        return await this.model.findAll();
    }

    /** Check if a TikTok stream config already exists */
    async streamExists(tiktokUsername: string, discordChannelId: string, guildId: string) {
        const existing = await this.getOne(
            { tiktokUsername, discordChannelId, guildId },
            { raw: true }
        );
        return !!existing;
    }

    /** Upsert (create or update) a TikTok stream configuration */
    async upsertStream(data: Partial<TikTokStreamConfig> & {
        tiktokUsername: string;
        discordChannelId: string;
        guildId: string;
    }) {
        const created = await this.upsert(data, ['guildId', 'tiktokUsername']);
        const record = await this.getOne(
            { tiktokUsername: data.tiktokUsername, discordChannelId: data.discordChannelId, guildId: data.guildId },
            { raw: true }
        );
        return { record, created };
    }

    /** Remove a stream configuration by TikTok username & Discord channel */
    async removeStream(tiktokUsername: string, discordChannelId: string, guildId: string) {
        await this.remove({ tiktokUsername, discordChannelId, guildId });
    }
}

