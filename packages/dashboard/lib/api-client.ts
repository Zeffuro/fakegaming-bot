// Compatibility barrel for dashboard API clients.
// New domains should live in packages/dashboard/lib/api/<domain>.ts and be composed here.
export { API_ENDPOINTS, apiRequest, type ApiOptions } from "./api/core";
export { createDisabledModuleRequest } from "./api/disabledFeatures";

export * from "./api/anime";
export * from "./api/audit";
export * from "./api/birthdays";
export * from "./api/bluesky";
export * from "./api/dashboard";
export * from "./api/discord";
export * from "./api/disabledFeatures";
export * from "./api/jobs";
export * from "./api/integrationHealth";
export * from "./api/notifications";
export * from "./api/patchNotes";
export * from "./api/setupTemplates";
export * from "./api/steamNews";
export * from "./api/quotes";
export * from "./api/riotLinks";
export * from "./api/tiktok";
export * from "./api/twitch";
export * from "./api/userNotes";
export * from "./api/userReminders";
export * from "./api/userSettings";
export * from "./api/userDigestSubscription";
export * from "./api/userActivity";
export * from "./api/youtube";

import { animeApi } from "./api/anime";
import { birthdaysApi } from "./api/birthdays";
import { blueskyApi } from "./api/bluesky";
import { dashboardApi } from "./api/dashboard";
import { discordApi } from "./api/discord";
import { disabledFeaturesApi } from "./api/disabledFeatures";
import { jobsApi } from "./api/jobs";
import { integrationHealthApi } from "./api/integrationHealth";
import { notificationsApi } from "./api/notifications";
import { patchNotesApi } from "./api/patchNotes";
import { setupTemplatesApi } from "./api/setupTemplates";
import { steamNewsApi } from "./api/steamNews";
import { quotesApi } from "./api/quotes";
import { riotLinksApi } from "./api/riotLinks";
import { tiktokApi } from "./api/tiktok";
import { twitchApi } from "./api/twitch";
import { userNotesApi } from "./api/userNotes";
import { userRemindersApi } from "./api/userReminders";
import { userSettingsApi } from "./api/userSettings";
import { userDigestSubscriptionApi } from "./api/userDigestSubscription";
import { userActivityApi } from "./api/userActivity";
import { youtubeApi } from "./api/youtube";

export const api = {
    ...dashboardApi,
    ...twitchApi,
    ...tiktokApi,
    ...blueskyApi,
    ...youtubeApi,
    ...patchNotesApi,
    ...setupTemplatesApi,
    ...steamNewsApi,
    ...animeApi,
    ...quotesApi,
    ...birthdaysApi,
    ...discordApi,
    ...disabledFeaturesApi,
    ...jobsApi,
    ...integrationHealthApi,
    ...notificationsApi,
    ...riotLinksApi,
    ...userNotesApi,
    ...userRemindersApi,
    ...userSettingsApi,
    ...userDigestSubscriptionApi,
    ...userActivityApi,
};
