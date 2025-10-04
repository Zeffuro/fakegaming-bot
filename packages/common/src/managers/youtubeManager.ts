import {BaseManager} from './baseManager.js';
import {YoutubeVideoConfig} from '../models/youtube-video-config.js';

export class YoutubeManager extends BaseManager<YoutubeVideoConfig> {
    constructor() {
        super(YoutubeVideoConfig);
    }

    async getVideoChannel({youtubeChannelId, discordChannelId, guildId}: {
        youtubeChannelId: string,
        discordChannelId: string,
        guildId: string
    }): Promise<YoutubeVideoConfig | null> {
        return (await this.getOne({youtubeChannelId, discordChannelId, guildId}))?.get() ?? null;
    }

    async setVideoChannel(channel: Partial<YoutubeVideoConfig>) {
        if (!channel.guildId) throw new Error('guildId is required');
        await this.upsert(channel);
    }
}