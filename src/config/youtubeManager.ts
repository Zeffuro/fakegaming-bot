import {db} from './db.js';
import {YoutubeVideoConfig} from '../types/youtubeVideoConfig.js';
import {UserConfig} from "../types/userConfig.js";

export class YoutubeManager {
    async addStream(config: YoutubeVideoConfig) {
        db.data!.youtubeVideoChannels ||= [];
        db.data!.youtubeVideoChannels.push(config);
        await db.write();
    }

    async addVideoChannel(config: YoutubeVideoConfig) {
        db.data!.youtubeVideoChannels ||= [];
        db.data!.youtubeVideoChannels.push(config);
        await db.write();
    }

    getStreams(): YoutubeVideoConfig[] {
        db.data!.youtubeVideoChannels ||= [];
        return db.data!.youtubeVideoChannels;
    }

    getVideoChannel(channelId: string): YoutubeVideoConfig | undefined {
        return db.data!.youtubeVideoChannels.find(channel => channel.youtubeChannelId === channelId);
    }

    getVideoChannels(): YoutubeVideoConfig[] {
        db.data!.youtubeVideoChannels ||= [];
        return db.data!.youtubeVideoChannels;
    }

    async setVideoChannel(channel: YoutubeVideoConfig) {
        const idx = db.data!.youtubeVideoChannels.findIndex(user => channel.youtubeChannelId === channel.youtubeChannelId);
        if (idx !== -1) {
            db.data!.youtubeVideoChannels[idx] = channel;
        } else {
            db.data!.youtubeVideoChannels.push(channel);
        }
        await db.write();
    }
}