import { Sequelize } from 'sequelize-typescript';
import { UserConfig } from './models/user-config.js';
import { LeagueConfig } from './models/league-config.js';
import { ServerConfig } from './models/server-config.js';
import { QuoteConfig } from './models/quote-config.js';
import { TwitchStreamConfig } from './models/twitch-stream-config.js';
import { YoutubeVideoConfig } from './models/youtube-video-config.js';
import { ReminderConfig } from './models/reminder-config.js';
import { BirthdayConfig } from './models/birthday-config.js';
import { PatchNoteConfig } from './models/patch-note-config.js';
import { PatchSubscriptionConfig } from './models/patch-subscription-config.js';
import path from "path";
import { resolveDataRoot } from "./core/dataRoot.js";
const provider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase();
let dbUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '');
const options = {
    dialect: provider,
    logging: false,
    models: [
        UserConfig,
        LeagueConfig,
        ServerConfig,
        QuoteConfig,
        TwitchStreamConfig,
        YoutubeVideoConfig,
        ReminderConfig,
        BirthdayConfig,
        PatchNoteConfig,
        PatchSubscriptionConfig
    ]
};
if (provider === 'sqlite') {
    options.storage = path.join(resolveDataRoot(), 'dev.sqlite');
}
else if (dbUrl) {
    options.url = dbUrl;
}
else {
    throw new Error(`DATABASE_URL is required for provider "${provider}".`);
}
export const sequelize = new Sequelize(options);
