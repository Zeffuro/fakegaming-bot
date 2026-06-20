import {getSequelize} from '../sequelize.js';
import {runMigrations} from '../migrate.js';
import {UserManager} from './userManager.js';
import {QuoteManager} from './quoteManager.js';
import {ServerManager} from './serverManager.js';
import {TwitchManager} from './twitchManager.js';
import {YoutubeManager} from "./youtubeManager.js";
import {ReminderManager} from "./reminderManager.js";
import {BirthdayManager} from "./birthdayManager.js";
import {PatchNoteHistoryManager, PatchNotesManager, PatchSubscriptionManager} from "./patchNotesManager.js";
import {DisabledCommandManager} from "./disabledCommandManager.js";
import {CacheManager} from "./cacheManager.js";
import {NotificationsManager} from './notificationsManager.js';
import {DisabledModuleManager} from './disabledModuleManager.js';
import {TikTokManager} from './tiktokManager.js';
import {BlueskyManager} from './blueskyManager.js';
import {AnimeManager} from './animeManager.js';
import {LeagueManager} from './leagueManager.js';
import {AuditEventManager} from './auditEventManager.js';
import {IntegrationHealthManager} from './integrationHealthManager.js';
import {getLogger} from '../utils/logger.js';

const log = getLogger({ name: 'common:config' });

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
    patchNoteHistoryManager = new PatchNoteHistoryManager();
    patchSubscriptionManager = new PatchSubscriptionManager();
    disabledCommandManager = new DisabledCommandManager();
    cacheManager = new CacheManager();
    notificationsManager = new NotificationsManager();
    disabledModuleManager = new DisabledModuleManager();
    tiktokManager = new TikTokManager();
    blueskyManager = new BlueskyManager();
    animeManager = new AnimeManager();
    leagueManager = new LeagueManager();
    auditEventManager = new AuditEventManager();
    integrationHealthManager = new IntegrationHealthManager();

    /**
     * Initializes the database (optional, for Sequelize sync).
     */
    async init(useTest = false) {
        log.info('Initializing database connection');
        try {
            await getSequelize(useTest).authenticate();
            log.info('Database connection successful');
        } catch (err) {
            log.error({ err }, 'Database connection failed');
            process.exit(1);
        }

        if (process.env.DB_MIGRATIONS_ENABLED !== '0') {
            await runMigrations(getSequelize(useTest));
        } else {
            log.info('Database migrations disabled by DB_MIGRATIONS_ENABLED=0');
        }

        if (process.env.DB_SYNC_ENABLED !== '0') {
            await getSequelize(useTest).sync();
        } else {
            log.info('Sequelize sync disabled by DB_SYNC_ENABLED=0');
        }
    }
}
