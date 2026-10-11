import { apiRequest } from './core';
import type { PersonalDashboardLayout } from '@zeffuro/fakegaming-common/dashboard-layout';
const endpoint = '/api/external/userDashboardLayout';
export const dashboardLayoutApi = {
    get: () => apiRequest<PersonalDashboardLayout>(endpoint),
    save: (body: PersonalDashboardLayout) => apiRequest<PersonalDashboardLayout>(endpoint, { method: 'PATCH', body }),
    reset: (version: number) => apiRequest<PersonalDashboardLayout>(`${endpoint}/reset`, { method: 'POST', body: { version } }),
};
