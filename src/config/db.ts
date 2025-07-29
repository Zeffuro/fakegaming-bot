import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {UserConfig} from '../types/userConfig';
import {ServerConfig} from '../types/serverConfig';

export type Data = {
    users: UserConfig[];
    servers: ServerConfig[];
    quotes: Quote[];
};

const adapter = new JSONFile<Data>('data/config.json');
export const db = new Low<Data>(adapter, {users: [], servers: [], quotes: []});