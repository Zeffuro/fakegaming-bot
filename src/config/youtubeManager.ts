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

    getVideoChannel(youtubeChannelId: string, discordChannelId: string): YoutubeVideoConfig | undefined {
        return db.data!.youtubeVideoChannels.find(
            channel => channel.youtubeChannelId === youtubeChannelId && channel.discordChannelId === discordChannelId
        );
    }

    getVideoChannels(): YoutubeVideoConfig[] {
        db.data!.youtubeVideoChannels ||= [];
        return db.data!.youtubeVideoChannels;
    }

    async setVideoChannel(channel: YoutubeVideoConfig) {
        const idx = db.data!.youtubeVideoChannels.findIndex(
            c => c.youtubeChannelId === channel.youtubeChannelId && c.discordChannelId === channel.discordChannelId
        );
        if (idx !== -1) {
            db.data!.youtubeVideoChannels[idx] = channel;
        } else {
            db.data!.youtubeVideoChannels.push(channel);
        }
        await db.write();
    }
}