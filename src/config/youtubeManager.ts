import {BaseManager} from './baseManager.js';
import {YoutubeVideoConfig} from '../types/youtubeVideoConfig.js';

export class YoutubeManager extends BaseManager<YoutubeVideoConfig> {
    constructor() {
        super('youtubeVideoChannels');
    }

    async addVideoChannel(config: YoutubeVideoConfig) {
        await this.add(config);
    }

    async getVideoChannel({youtubeChannelId, discordChannelId}: {
        youtubeChannelId: string,
        discordChannelId: string
    }): Promise<YoutubeVideoConfig | undefined> {
        return this.collection.find(
            channel => channel.youtubeChannelId === youtubeChannelId && channel.discordChannelId === discordChannelId
        );
    }

    async setVideoChannel(channel: YoutubeVideoConfig) {
        const idx = this.collection.findIndex(
            c => c.youtubeChannelId === channel.youtubeChannelId && c.discordChannelId === channel.discordChannelId
        );
        if (idx !== -1) {
            this.collection[idx] = channel;
        } else {
            this.collection.push(channel);
        }
        await this.setAll(this.collection);
    }
}