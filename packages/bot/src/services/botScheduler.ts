import {Client} from "discord.js";
import {scheduleAtTime} from '../utils/scheduleAtTime.js';
import {getConfigManager} from "@zeffuro/fakegaming-common/managers";
import {subscribeAllStreams} from './twitchService.js';
import {checkAndAnnounceNewVideos} from './youtubeService.js';
import {checkAndSendReminders} from './reminderService.js';
import {checkAndAnnounceBirthdays} from './birthdayService.js';
import {announceNewPatchNotes, scanAndUpdatePatchNotes} from "./patchNotesService.js";
import {minutes} from "../utils/generalUtils.js";
import { getLogger, incMetric } from '@zeffuro/fakegaming-common';

const logger = getLogger({ name: 'bot.scheduler' });

function parseDisabledJobs(): Set<string> {
    const out = new Set<string>();
    const raw = process.env.BOT_JOBS_DISABLED || '';
    for (const token of raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) {
        out.add(token);
    }
    // Backward compatibility: specific flag disables birthdays
    if (process.env.BOT_DISABLE_LOCAL_BIRTHDAYS === '1') out.add('birthdays');
    return out;
}

function isDisabled(disabled: Set<string>, name: string): boolean {
    return disabled.has('all') || disabled.has(name);
}

/**
 * Runs a background service and logs errors if they occur.
 */
async function runService<T>(service: (client: T) => Promise<unknown>, name: string, client: T) {
    incMetric('job_start', { job: name });
    try {
        await service(client);
        incMetric('job_ok', { job: name });
    } catch (err) {
        incMetric('job_error', { job: name });
        logger.error({ err, service: name }, `Error in ${name}:`);
    }
}

/**
 * Starts all bot background services and schedules periodic checks.
 */
export function startBotServices(client: Client) {
    const disabled = parseDisabledJobs();

    if (!isDisabled(disabled, 'twitch')) {
        void runService(subscribeAllStreams, 'subscribeAllStreams', client);
        setInterval(() => { void runService(subscribeAllStreams, 'subscribeAllStreams', client); }, minutes(1));
    }

    if (!isDisabled(disabled, 'youtube')) {
        void runService(checkAndAnnounceNewVideos, 'checkAndAnnounceNewVideos', client);
        setInterval(() => { void runService(checkAndAnnounceNewVideos, 'checkAndAnnounceNewVideos', client); }, minutes(5));
    }

    if (!isDisabled(disabled, 'reminders')) {
        void runService(checkAndSendReminders, 'checkAndSendReminders', client);
        setInterval(() => { void runService(checkAndSendReminders, 'checkAndSendReminders', client); }, minutes(1));
    }

    if (!isDisabled(disabled, 'patchnotes')) {
        void runService(scanAndUpdatePatchNotes, 'scanAndUpdatePatchNotes', getConfigManager().patchNotesManager);
        setInterval(() => { void runService(scanAndUpdatePatchNotes, 'scanAndUpdatePatchNotes', getConfigManager().patchNotesManager); }, minutes(60));
        void runService(announceNewPatchNotes, 'announceNewPatchNotes', client);
        setInterval(() => { void runService(announceNewPatchNotes, 'announceNewPatchNotes', client); }, minutes(10));
    }

    // Birthdays: auto-disable if centralized jobs are enabled on API; also support env-based disabling
    const centralizedJobs = process.env.JOBS_ENABLED === '1';
    const birthdaysDisabled = centralizedJobs || isDisabled(disabled, 'birthdays');
    if (!birthdaysDisabled) {
        void runService(checkAndAnnounceBirthdays, 'checkAndAnnounceBirthdays', client);
        scheduleAtTime(9, 0, () => { void runService(checkAndAnnounceBirthdays, 'checkAndAnnounceBirthdays', client); });
    }
}