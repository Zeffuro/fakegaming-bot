import {BaseManager} from './baseManager.js';
import {ServerConfig} from '../models/server-config.js';

export class ServerManager extends BaseManager<ServerConfig> {
    constructor() {
        super(ServerConfig);
    }

    async getServer(serverId: string): Promise<ServerConfig | null> {
        return (await this.model.findOne({where: {serverId}}))?.get() ?? null;
    }
}