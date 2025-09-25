import {getSequelize} from '../sequelize.js';
import {runMigrations} from '../migrate.js';
import {UserManager} from './userManager.js';
import {QuoteManager} from './quoteManager.js';
import {ServerManager} from './serverManager.js';
import {TwitchManager} from './twitchManager.js';
import {YoutubeManager} from "./youtubeManager.js";
import {ReminderManager} from "./reminderManager.js";
import {BirthdayManager} from "./birthdayManager.js";
import {PatchNotesManager, PatchSubscriptionManager} from "./patchNotesManager.js";

/**
 * Aggregates all manager classes.
 */
export class ConfigManager {
    userManager = new UserManager();
    quoteManager = new QuoteManager();
    serverManager = new ServerManager();
    twitchManager = new TwitchManager();
    youtubeManager = new YoutubeManager();
    reminderManager = new ReminderManager();
    birthdayManager = new BirthdayManager();
    patchNotesManager = new PatchNotesManager();
    patchSubscriptionManager = new PatchSubscriptionManager();

    /**
     * Initializes the database (optional, for Sequelize sync).
     */
    async init() {
        console.log('Initializing database connection...');
        await getSequelize().authenticate()
            .then(() => {
                console.log('Database connection successful.');
                // Start your app logic here
            })
            .catch((err) => {
                console.error('Database connection failed:', err);
                process.exit(1);
            });
        //await sequelize.authenticate();
        await runMigrations(getSequelize());
        await getSequelize().sync();
    }
}