import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {UserConfig} from '../types/userConfig.js';
import {ServerConfig} from '../types/serverConfig.js';
import {QuoteConfig} from '../types/quoteConfig.js';
import {TwitchStreamConfig} from "../types/twitchStreamConfig.js";
import {YoutubeVideoConfig} from "../types/youtubeVideoConfig.js";
import {ReminderConfig} from "../types/reminderConfig.js";
import {BirthdayConfig} from "../types/birthdayConfig.js";
import path from "path";

/**
 * Represents the structure of all configuration data stored in the database.
 * Includes users, servers, quotes, streams, channels, reminders, and birthdays.
 */
export type Data = {
    users: UserConfig[];
    servers: ServerConfig[];
    quotes: QuoteConfig[];
    twitchStreams: TwitchStreamConfig[];
    youtubeVideoChannels: YoutubeVideoConfig[];
    reminders: ReminderConfig[];
    birthdays: BirthdayConfig[];
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
    birthdays: []
};

const dataRoot = process.env.DATA_ROOT || 'data';
const adapter = new JSONFile<Data>(path.join(dataRoot, 'config.json'));

/**
 * The main config database instance, using LowDB and JSONFile for persistent storage.
 */
export const db = new Low<Data>(adapter, defaultData);