import {scheduleAtTime} from '../utils/scheduleAtTime.js';
import {configManager} from "../../../common/src/managers/configManagerSingleton.js";
import {subscribeAllStreams} from './twitchService.js';
import {checkAndAnnounceNewVideos} from './youtubeService.js';
import {checkAndSendReminders} from './reminderService.js';
import {checkAndAnnounceBirthdays} from './birthdayService.js';
import {announceNewPatchNotes, scanAndUpdatePatchNotes} from "./patchNotesService.js";
import {minutes} from "../utils/generalUtils.js";

/**
 * Runs a background service and logs errors if they occur.
 */
function runService(service: (_client?: any) => Promise<any>, name: string, _client?: any) {
    service(_client).catch(err => console.error(`Error in ${name}:`, err));
}

/**
 * Starts all bot background services and schedules periodic checks.
 */
export function startBotServices(client: any) {
    runService(subscribeAllStreams, 'subscribeAllStreams', client);
    runService(checkAndAnnounceNewVideos, 'checkAndAnnounceNewVideos', client);
    runService(checkAndSendReminders, 'checkAndSendReminders', client);
    runService(checkAndAnnounceBirthdays, 'checkAndAnnounceBirthdays', client);
    runService(scanAndUpdatePatchNotes, 'scanAndUpdatePatchNotes', configManager.patchNotesManager);
    runService(announceNewPatchNotes, 'announceNewPatchNotes', client);

    setInterval(() => runService(subscribeAllStreams, 'subscribeAllStreams', client), minutes(1));
    setInterval(() => runService(checkAndAnnounceNewVideos, 'checkAndAnnounceNewVideos', client), minutes(5));
    setInterval(() => runService(checkAndSendReminders, 'checkAndSendReminders', client), minutes(1));
    setInterval(() => runService(scanAndUpdatePatchNotes, 'scanAndUpdatePatchNotes', configManager.patchNotesManager), minutes(60));
    setInterval(() => runService(announceNewPatchNotes, 'announceNewPatchNotes', client), minutes(10));
    scheduleAtTime(9, 0, () => runService(checkAndAnnounceBirthdays, 'checkAndAnnounceBirthdays', client));
}