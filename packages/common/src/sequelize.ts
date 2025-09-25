import {Sequelize} from 'sequelize-typescript';
import {Dialect} from 'sequelize';
import {UserConfig} from './models/user-config.js';
import {LeagueConfig} from './models/league-config.js';
import {ServerConfig} from './models/server-config.js';
import {QuoteConfig} from './models/quote-config.js';
import {TwitchStreamConfig} from './models/twitch-stream-config.js';
import {YoutubeVideoConfig} from './models/youtube-video-config.js';
import {ReminderConfig} from './models/reminder-config.js';
import {BirthdayConfig} from './models/birthday-config.js';
import {PatchNoteConfig} from './models/patch-note-config.js';
import {PatchSubscriptionConfig} from './models/patch-subscription-config.js';
import path from "path";
import {resolveDataRoot} from "./core/dataRoot.js";
import type {Options} from 'sequelize';

let sequelize: Sequelize | undefined;

export function getSequelize(): Sequelize {
    if (sequelize) return sequelize;

    const provider: Dialect = process.env.DATABASE_PROVIDER as Dialect;
    const dbUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '');

    const options: Options = {
        dialect: provider,
        logging: false,
    };

    if (provider === 'sqlite') {
        options.storage = path.join(resolveDataRoot(), 'dev.sqlite');
        sequelize = new Sequelize(options);
    } else if (dbUrl) {
        sequelize = new Sequelize(dbUrl, options);
    } else {
        throw new Error(`DATABASE_URL is required for provider "${provider}".`);
    }

    sequelize.addModels([
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
    ]);

    return sequelize;
}