import {BaseManager} from './baseManager.js';
import {TwitchStreamConfig} from '../models/twitch-stream-config.js';

export class TwitchManager extends BaseManager<TwitchStreamConfig> {
    constructor() {
        super(TwitchStreamConfig);
    }

    /** Get all Twitch stream configurations (plain objects for services) */
    async getAllStreams() {
        return await this.model.findAll();
    }

    /** Check if a Twitch stream config already exists */
    async streamExists(twitchUsername: string, discordChannelId: string, guildId: string) {
        const existing = await this.getOne(
            { twitchUsername, discordChannelId, guildId },
            { raw: true }
        );
        return !!existing;
    }

    /** Upsert (create or update) a Twitch stream configuration */
    async upsertStream(data: Partial<TwitchStreamConfig> & {
        twitchUsername: string;
        discordChannelId: string;
        guildId: string;
    }) {
        const created = await this.upsert(data);
        const record = await this.getOne(
            { twitchUsername: data.twitchUsername, discordChannelId: data.discordChannelId, guildId: data.guildId },
            { raw: true }
        );
        return { record, created };
    }

    /** Remove a stream configuration by Twitch username & Discord channel */
    async removeStream(twitchUsername: string, discordChannelId: string, guildId: string) {
        await this.remove({ twitchUsername, discordChannelId, guildId });
    }
}