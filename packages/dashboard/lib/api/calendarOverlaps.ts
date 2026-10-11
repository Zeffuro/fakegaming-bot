import { apiRequest } from './core';

export interface OverlapEvent {
    id: string; title: string; sourceLabel: string; timezone: string; startAt: number; endAt: number;
}
export interface CalendarOverlap { first: OverlapEvent; second: OverlapEvent; startAt: number; endAt: number }
export interface CalendarOverlapPage {
    overlaps: CalendarOverlap[]; total: number; offset: number; limit: number; checkedAt: number; until: number;
    connected: boolean; sources: { id: string; label: string; lastSyncedAt: number | null }[];
}
export const calendarOverlapsApi = {
    list: (offset = 0, limit = 10) => apiRequest<CalendarOverlapPage>(`/api/external/calendarOverlaps?offset=${offset}&limit=${limit}`),
};
