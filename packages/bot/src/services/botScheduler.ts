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
    void runService(subscribeAllStreams, 'subscribeAllStreams', client);
    void runService(checkAndAnnounceNewVideos, 'checkAndAnnounceNewVideos', client);
    void runService(checkAndSendReminders, 'checkAndSendReminders', client);
    void runService(checkAndAnnounceBirthdays, 'checkAndAnnounceBirthdays', client);
    void runService(scanAndUpdatePatchNotes, 'scanAndUpdatePatchNotes', getConfigManager().patchNotesManager);
    void runService(announceNewPatchNotes, 'announceNewPatchNotes', client);

    setInterval(() => { void runService(subscribeAllStreams, 'subscribeAllStreams', client); }, minutes(1));
    setInterval(() => { void runService(checkAndAnnounceNewVideos, 'checkAndAnnounceNewVideos', client); }, minutes(5));
    setInterval(() => { void runService(checkAndSendReminders, 'checkAndSendReminders', client); }, minutes(1));
    setInterval(() => { void runService(scanAndUpdatePatchNotes, 'scanAndUpdatePatchNotes', getConfigManager().patchNotesManager); }, minutes(60));
    setInterval(() => { void runService(announceNewPatchNotes, 'announceNewPatchNotes', client); }, minutes(10));
    scheduleAtTime(9, 0, () => { void runService(checkAndAnnounceBirthdays, 'checkAndAnnounceBirthdays', client); });
}