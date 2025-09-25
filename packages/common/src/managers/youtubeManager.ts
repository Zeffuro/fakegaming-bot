import {BaseManager} from './baseManager.js';
import {YoutubeVideoConfig} from '../models/youtube-video-config.js';

/**
 * Manages YouTube video channel configuration records.
 */
export class YoutubeManager extends BaseManager<YoutubeVideoConfig> {
    constructor() {
        super(YoutubeVideoConfig);
    }

    // Removed the addVideoChannel method
    // async addVideoChannel(config: Partial<YoutubeVideoConfig>) {
    //     await this.add(config);
    // }

    async getVideoChannel({youtubeChannelId, discordChannelId}: {
        youtubeChannelId: string,
        discordChannelId: string
    }): Promise<YoutubeVideoConfig | null> {
        return (await this.getOne({youtubeChannelId, discordChannelId}))?.get() ?? null;
    }

    // Simplified to use the new upsert method in BaseManager
    async setVideoChannel(channel: Partial<YoutubeVideoConfig>) {
        await this.upsert(channel);
    }
}