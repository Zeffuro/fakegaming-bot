import { apiBinaryRequest, apiRequest } from './core';

export interface CalendarSource {
    id: string; calendarId: string; label: string; timezone: string; titleFilter: string | null;
    enabled: boolean; version: number; lastSyncedAt: number | null;
}
export interface CalendarStatus { configured: boolean; connected: boolean; sources: CalendarSource[] }
export interface AvailableCalendar { id: string; summary: string; timeZone: string }
const endpoint = '/api/external/userCalendar';

export const userCalendarApi = {
    status: () => apiRequest<CalendarStatus>(endpoint),
    calendars: () => apiRequest<{ calendars: AvailableCalendar[] }>(`${endpoint}/calendars`),
    connect: () => apiRequest<{ url: string }>('/api/auth/google-calendar/connect', { method: 'POST', body: {} }),
    disconnect: () => apiRequest<{ success: boolean }>(endpoint, { method: 'DELETE' }),
    select: (calendarId: string, titleFilter: string) => apiRequest<{ source: CalendarSource; syncPending: boolean }>(`${endpoint}/sources`, { method: 'POST', body: { calendarId, titleFilter: titleFilter || null } }),
    sync: (id: string) => apiRequest<{ success: boolean }>(`${endpoint}/sources/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} }),
    remove: (id: string) => apiRequest<{ success: boolean }>(`${endpoint}/sources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    export: (format: 'json' | 'csv') => apiBinaryRequest(`${endpoint}/export?format=${format}`),
};
