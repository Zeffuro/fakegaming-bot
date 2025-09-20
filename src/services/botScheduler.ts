import {scheduleAtTime} from '../utils/scheduleAtTime.js';
import {subscribeAllStreams} from './twitchService.js';
import {checkAndAnnounceNewVideos} from './youtubeService.js';
import {checkAndSendReminders} from './reminderService.js';
import {checkAndAnnounceBirthdays} from './birthdayService.js';

/**
 * Runs a background service and logs errors if they occur.
 */
function runService(service: (client: any) => Promise<any>, client: any, name: string) {
    service(client).catch(err => console.error(`Error in ${name}:`, err));
}

/**
 * Starts all bot background services and schedules periodic checks.
 */
export function startBotServices(client: any) {
    runService(subscribeAllStreams, client, 'subscribeAllStreams');
    runService(checkAndAnnounceNewVideos, client, 'checkAndAnnounceNewVideos');
    runService(checkAndSendReminders, client, 'checkAndSendReminders');
    runService(checkAndAnnounceBirthdays, client, 'checkAndAnnounceBirthdays');

    setInterval(() => runService(subscribeAllStreams, client, 'subscribeAllStreams'), 60_000);
    setInterval(() => runService(checkAndAnnounceNewVideos, client, 'checkAndAnnounceNewVideos'), 5 * 60_000);
    setInterval(() => runService(checkAndSendReminders, client, 'checkAndSendReminders'), 60_000);
    scheduleAtTime(9, 0, () => runService(checkAndAnnounceBirthdays, client, 'checkAndAnnounceBirthdays'));
}