import {BaseManager} from './baseManager.js';
import {YoutubeVideoConfig} from '../types/youtubeVideoConfig.js';

/**
 * Manages YouTube video channel configuration records.
 */
export class YoutubeManager extends BaseManager<YoutubeVideoConfig> {
    /**
     * Creates a new YoutubeManager.
     */
    constructor() {
        super('youtubeVideoChannels');
    }

    /**
     * Adds a YouTube video channel configuration.
     * @param config The channel configuration to add.
     */
    async addVideoChannel(config: YoutubeVideoConfig) {
        await this.add(config);
    }

    /**
     * Gets a YouTube video channel configuration by YouTube and Discord channel IDs.
     * @param youtubeChannelId The YouTube channel ID.
     * @param discordChannelId The Discord channel ID.
     * @returns The channel configuration, or undefined if not found.
     */
    async getVideoChannel({youtubeChannelId, discordChannelId}: {
        youtubeChannelId: string,
        discordChannelId: string
    }): Promise<YoutubeVideoConfig | undefined> {
        return this.collection.find(
            channel => channel.youtubeChannelId === youtubeChannelId && channel.discordChannelId === discordChannelId
        );
    }

    /**
     * Sets or updates a YouTube video channel configuration.
     * @param channel The channel configuration to set.
     */
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