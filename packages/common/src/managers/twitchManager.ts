import {BaseManager} from './baseManager.js';
import {TwitchStreamConfig} from '../models/twitch-stream-config.js';

/**
 * Manages Twitch stream configuration records.
 */
export class TwitchManager extends BaseManager<TwitchStreamConfig> {
    constructor() {
        super(TwitchStreamConfig);
    }

    /**
     * Checks if a Twitch stream is already configured for a Discord channel.
     * @param twitchUsername Twitch username.
     * @param discordChannelId Discord channel ID.
     * @returns Promise resolving to true if exists, false otherwise.
     */
    // Simplified to use the new exists method in BaseManager
    async streamExists(twitchUsername: string, discordChannelId: string): Promise<boolean> {
        return await super.exists({twitchUsername, discordChannelId});
    }
}