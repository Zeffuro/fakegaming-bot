import {Sequelize} from 'sequelize-typescript';
import type {Dialect} from 'sequelize';
import {UserConfig} from '../models/user-config.js';
import {LeagueConfig} from '../models/league-config.js';
import {ServerConfig} from '../models/server-config.js';
import {QuoteConfig} from '../models/quote-config.js';
import {TwitchStreamConfig} from '../models/twitch-stream-config.js';
import {YoutubeVideoConfig} from '../models/youtube-video-config.js';
import {ReminderConfig} from '../models/reminder-config.js';
import {BirthdayConfig} from '../models/birthday-config.js';
import {PatchNoteConfig} from '../models/patch-note-config.js';
import {PatchSubscriptionConfig} from '../models/patch-subscription-config.js';

const dbUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '') || 'sqlite://./data/dev.sqlite';

export const sequelize = new Sequelize(
    dbUrl,
    {
        dialect: process.env.DATABASE_PROVIDER as Dialect,
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
    }
);