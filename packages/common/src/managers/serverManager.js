import { BaseManager } from './baseManager.js';
import { ServerConfig } from '../models/server-config.js';
/**
 * Manages server configuration records.
 */
export class ServerManager extends BaseManager {
    constructor() {
        super(ServerConfig);
    }
    async getServer(serverId) {
        return await this.model.findOne({ where: { serverId } });
    }
}
