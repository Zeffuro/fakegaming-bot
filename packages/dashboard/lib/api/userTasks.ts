import { apiRequest } from './core';

export interface EditableTask {
    id: string; title: string; state: 'active' | 'completed';
    checklist: Array<{ text: string; done: boolean }>;
    dueAt: number | null; timezone: string; version: number;
    completedAt: number | null; sourceUrl: string | null;
    canUndo: boolean;
}
export interface TaskEdit {
    version: number; title: string; checklist: EditableTask['checklist']; due?: string | null; timezone: string;
}
const endpoint = '/api/external/userTasks';
export const userTasksApi = {
    list: () => apiRequest<{ active: EditableTask[]; completed: EditableTask[]; timezone: string }>(endpoint),
    edit: (id: string, body: TaskEdit) => apiRequest<EditableTask>(`${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
};
