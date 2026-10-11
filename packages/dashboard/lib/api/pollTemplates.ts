import { apiRequest } from './core';

export interface PollTemplateInput {
    title: string; question: string; options: string[]; durationMinutes: number; allowMultiple: boolean; hideResults: boolean; ranked: boolean;
}
export interface PollTemplate extends PollTemplateInput { id: string; version: number }
const path = '/api/external/pollTemplates';
export const pollTemplatesApi = {
    list: () => apiRequest<PollTemplate[]>(path),
    create: (input: PollTemplateInput) => apiRequest<PollTemplate>(path, { method: 'POST', body: input }),
    edit: (id: string, input: PollTemplateInput & { version: number }) => apiRequest<PollTemplate>(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
    remove: (id: string, version: number) => apiRequest(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { version } }),
};
