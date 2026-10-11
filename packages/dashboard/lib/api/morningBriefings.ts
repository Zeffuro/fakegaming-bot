import { apiRequest } from './core';
import type { MorningBriefingPreferences, MorningBriefingPreview } from '@zeffuro/fakegaming-common/api';
export type { MorningBriefingPreferences, MorningBriefingPreview } from '@zeffuro/fakegaming-common/api';

const endpoint = '/api/external/morningBriefings';
export const morningBriefingsApi = {
    get: () => apiRequest<MorningBriefingPreferences>(endpoint),
    save: (body: MorningBriefingPreferences) => apiRequest<MorningBriefingPreferences>(endpoint, { method: 'PATCH', body }),
    preview: () => apiRequest<MorningBriefingPreview>(`${endpoint}/preview`),
};
