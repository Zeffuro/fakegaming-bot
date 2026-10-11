import { apiRequest } from './core';
import type { PersonalNotificationPauseInput, PersonalNotificationPausePreferences } from '@zeffuro/fakegaming-common/api';
export type { PersonalNotificationPauseInput, PersonalNotificationPausePreferences } from '@zeffuro/fakegaming-common/api';
const endpoint = '/api/external/userNotificationPause';
export const notificationPauseApi = {
    get: () => apiRequest<PersonalNotificationPausePreferences>(endpoint),
    save: (body: PersonalNotificationPauseInput) => apiRequest<PersonalNotificationPausePreferences>(endpoint, { method: 'PATCH', body }),
};
