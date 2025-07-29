import {db} from './db.js';
import {UserManager} from './userManager.js';
import {QuoteManager} from './quoteManager.js';
import {ServerManager} from './serverManager.js';

export class ConfigManager {
    userManager = new UserManager();
    quoteManager = new QuoteManager();
    serverManager = new ServerManager();

    async init() {
        await db.read();
        db.data ||= {users: [], servers: [], quotes: []};
    }
}