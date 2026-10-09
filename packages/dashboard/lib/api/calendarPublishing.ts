import { apiRequest } from './core';

export interface CalendarPublication {
    id: string; sourceId: string; guildId: string; channelId: string; guildName: string; channelName: string;
    lookaheadDays: number; eventLeadDays: number | null; publicTitle: string | null; enabled: boolean;
    lastError: string | null; uncertainCount: number;
}

export interface CalendarPublicationInput {
    sourceId: string; guildId: string; channelId: string; lookaheadDays: number;
    eventLeadDays: number | null; publicTitle: string | null;
}

export interface CalendarPublicationPreview {
    draftId: string; expiresAt: number; guildName: string; channelName: string; count: number; eventCount: number;
    lookaheadDays: number; eventLeadDays: number | null; publicTitle: string | null;
    events: { title: string; plannedAt: number; endAt: number | null; timezone: string; allDay: boolean;
        discordEvent: { name: string; plannedAt: number; endAt: number; location: string; description: string } | null }[];
}

const endpoint = '/api/external/userCalendar/publications';
export const calendarPublishingApi = {
    list: () => apiRequest<{ publications: CalendarPublication[] }>(endpoint),
    preview: (input: CalendarPublicationInput) => apiRequest<CalendarPublicationPreview>(`${endpoint}/preview`, { method: 'POST', body: input }),
    confirm: (input: { draftId: string; acknowledgeChannel: true; acknowledgeServerEvents: boolean; confirmChannelName: string }) =>
        apiRequest<{ publication: CalendarPublication }>(`${endpoint}/confirm`, { method: 'POST', body: input }),
    stop: (id: string) => apiRequest<{ success: boolean }>(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
