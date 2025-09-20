import {BaseManager} from './baseManager.js';
import {ServerConfig} from '../types/serverConfig.js';

export class ServerManager extends BaseManager<ServerConfig> {
    constructor() {
        super('servers');
    }

    getServer(serverId: string): ServerConfig | undefined {
        return this.collection.find(server => server.serverId === serverId);
    }
}