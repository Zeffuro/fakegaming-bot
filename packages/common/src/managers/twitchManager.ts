import {BaseManager} from './baseManager.js';
import {TwitchStreamConfig} from '../models/twitch-stream-config.js';

export class TwitchManager extends BaseManager<TwitchStreamConfig> {
    constructor() {
        super(TwitchStreamConfig);
    }

    async streamExists(twitchUsername: string, discordChannelId: string, guildId: string): Promise<boolean> {
        return await super.exists({twitchUsername, discordChannelId, guildId});
    }
}