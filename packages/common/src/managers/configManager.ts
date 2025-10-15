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
import {DisabledCommandManager} from "./disabledCommandManager.js";
import {CacheManager} from "./cacheManager.js";
import {NotificationsManager} from './notificationsManager.js';

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
    disabledCommandManager = new DisabledCommandManager();
    cacheManager = new CacheManager();
    notificationsManager = new NotificationsManager();

    /**
     * Initializes the database (optional, for Sequelize sync).
     */
    async init(useTest = false) {
        console.log('Initializing database connection...');
        await getSequelize(useTest).authenticate()
            .then(() => {
                console.log('Database connection successful.');
            })
            .catch((err) => {
                console.error('Database connection failed:', err);
                process.exit(1);
            });
        await runMigrations(getSequelize(useTest));
        await getSequelize(useTest).sync();
    }
}