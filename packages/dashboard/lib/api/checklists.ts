import { apiRequest } from './core';

export interface ChecklistTemplate { id: string; title: string; items: string[]; version: number }
const path = '/api/external/userChecklistTemplates';
export const checklistsApi = {
    list: () => apiRequest<ChecklistTemplate[]>(path),
    create: (input: { title: string; items: string[] }) => apiRequest<ChecklistTemplate>(path, { method: 'POST', body: input }),
    edit: (id: string, input: { title: string; items: string[]; version: number }) => apiRequest<ChecklistTemplate>(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
    remove: (id: string, version: number) => apiRequest(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { version } }),
    start: (id: string, input: { version: number; due?: string | null; timezone?: string }) => apiRequest<{ id: string }>(`${path}/${encodeURIComponent(id)}/start`, { method: 'POST', body: input }),
};
