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

export type Data = {
    users: UserConfig[];
    servers: ServerConfig[];
    quotes: QuoteConfig[];
    twitchStreams: TwitchStreamConfig[];
    youtubeVideoChannels: YoutubeVideoConfig[];
    reminders: ReminderConfig[];
    birthdays: BirthdayConfig[];
};

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

export const db = new Low<Data>(adapter, defaultData);