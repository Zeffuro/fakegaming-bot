import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {UserConfig} from '../../../common/src/models/user-config.js';
import {ServerConfig} from '../../../common/src/models/server-config.js';
import {QuoteConfig} from '../../../common/src/models/quote-config.js';
import {TwitchStreamConfig} from '../../../common/src/models/twitch-stream-config.js';
import {YoutubeVideoConfig} from '../../../common/src/models/youtube-video-config.js';
import {ReminderConfig} from '../../../common/src/models/reminder-config.js';
import {BirthdayConfig} from '../../../common/src/models/birthday-config.js';
import path from "path";
import {PatchNoteConfig} from '../../../common/src/models/patch-note-config.js';
import {PatchSubscriptionConfig} from '../../../common/src/models/patch-subscription-config.js';

/**
 * Represents the structure of all configuration data stored in the database.
 * Includes users, servers, quotes, streams, channels, reminders, and birthdays.
 */
export type Data = {
    users: Array<{
        discordId: string;
        timezone?: string;
        defaultReminderTimeSpan?: string;
        league?: {
            summonerName: string;
            region: string;
            puuid: string;
        };
    }>;
    servers: Array<{ serverId: string; prefix: string; welcomeMessage?: string; }>;
    quotes: Array<{
        id: string;
        guildId: string;
        quote: string;
        authorId: string;
        submitterId: string;
        timestamp: number;
    }>;
    twitchStreams: Array<{ twitchUsername: string; discordChannelId: string; customMessage?: string; }>;
    youtubeVideoChannels: Array<{
        youtubeChannelId: string;
        discordChannelId: string;
        lastVideoId?: string;
        customMessage?: string;
    }>;
    reminders: Array<{
        id: string;
        userId: string;
        message: string;
        timespan: string;
        timestamp: number;
        completed?: boolean;
    }>;
    birthdays: Array<{
        userId: string;
        day: number;
        month: number;
        year?: number;
        guildId: string;
        channelId: string;
    }>;
    patchNotes: Array<{
        game: string;
        title: string;
        content: string;
        url: string;
        publishedAt: number;
        logoUrl?: string;
        imageUrl?: string;
        version?: string;
        accentColor?: number;
    }>;
    patchSubscriptions: Array<{ game: string; channelId: string; lastAnnouncedAt?: number; }>;
};

/**
 * The default initial data for the config database, used if no config file exists.
 */
export const defaultData: Data = {
    users: [],
    servers: [],
    quotes: [],
    twitchStreams: [],
    youtubeVideoChannels: [],
    reminders: [],
    birthdays: [],
    patchNotes: [],
    patchSubscriptions: []
};

const dataRoot = process.env.DATA_ROOT || 'data';
const adapter = new JSONFile<Data>(path.join(dataRoot, 'config.json'));

/**
 * The main config database instance, using LowDB and JSONFile for persistent storage.
 */
export const db = new Low<Data>(adapter, defaultData);