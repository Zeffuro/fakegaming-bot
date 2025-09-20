import {BaseManager} from './baseManager.js';
import {ServerConfig} from '../types/serverConfig.js';

/**
 * Manages server configuration records.
 */
export class ServerManager extends BaseManager<ServerConfig> {
    /**
     * Creates a new ServerManager.
     */
    constructor() {
        super('servers');
    }

    /**
     * Gets the server configuration for a given server ID.
     * @param serverId The server's ID.
     * @returns The server configuration, or undefined if not found.
     */
    getServer(serverId: string): ServerConfig | undefined {
        return this.collection.find(server => server.serverId === serverId);
    }
}