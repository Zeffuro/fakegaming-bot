import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {UserConfig} from '../types/userConfig.js';
import {ServerConfig} from '../types/serverConfig.js';
import {QuoteConfig} from '../types/quoteConfig.js';
import {TwitchStreamConfig} from "../types/twitchStreamConfig.js";

export type Data = {
    users: UserConfig[];
    servers: ServerConfig[];
    quotes: QuoteConfig[];
    twitchStreams: TwitchStreamConfig[];
};

const adapter = new JSONFile<Data>('data/config.json');
export const db = new Low<Data>(adapter, {users: [], servers: [], quotes: [], twitchStreams: []});