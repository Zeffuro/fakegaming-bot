import {db} from './db.js';
import {TwitchStreamConfig} from '../types/twitchStreamConfig.js';

export class TwitchManager {
    async addStream(config: TwitchStreamConfig) {
        db.data!.twitchStreams ||= [];
        db.data!.twitchStreams.push(config);
        await db.write();
    }

    getStreams(): TwitchStreamConfig[] {
        db.data!.twitchStreams ||= [];
        return db.data!.twitchStreams;
    }
}