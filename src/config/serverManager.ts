import {db} from './db.js';
import {ServerConfig} from '../types/serverConfig.js';

export class ServerManager {
    async addServer(server: ServerConfig) {
        db.data!.servers.push(server);
        await db.write();
    }

    getServer(serverId: string): ServerConfig | undefined {
        return db.data!.servers.find(server => server.serverId === serverId);
    }
}