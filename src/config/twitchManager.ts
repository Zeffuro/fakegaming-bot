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
    async exists(twitchUsername: string, discordChannelId: string): Promise<boolean> {
        const stream = await this.model.findOne({where: {twitchUsername, discordChannelId}});
        return !!stream;
    }
}