import {BaseManager} from './baseManager.js';
import {YoutubeVideoConfig} from '../models/youtube-video-config.js';

export class YoutubeManager extends BaseManager<YoutubeVideoConfig> {
    constructor() {
        super(YoutubeVideoConfig);
    }

    /** Get all YouTube channel configurations (plain objects for services) */
    async getAllChannels() {
        return await this.model.findAll();
    }

    /** Get one YouTube channel config */
    async getVideoChannel(where: {
        youtubeChannelId: string;
        discordChannelId: string;
        guildId: string;
    }) {
        return this.getOne(where, { raw: true });
    }

    /** Set or update YouTube channel configuration */
    async setVideoChannel(data: Partial<YoutubeVideoConfig> & {
        youtubeChannelId: string;
        discordChannelId: string;
        guildId: string;
    }) {
        const created = await this.upsert(data, ['guildId', 'youtubeChannelId']);
        const record = await this.getOne(
            { youtubeChannelId: data.youtubeChannelId, discordChannelId: data.discordChannelId, guildId: data.guildId },
            { raw: true }
        );
        return { record, created };
    }

    /** Remove a YouTube channel configuration */
    async removeVideoChannel(youtubeChannelId: string, discordChannelId: string, guildId: string) {
        await this.remove({ youtubeChannelId, discordChannelId, guildId });
    }
}