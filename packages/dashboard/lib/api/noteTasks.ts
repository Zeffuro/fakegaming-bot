import { API_ENDPOINTS, apiRequest } from "./core";

export interface LinkedNoteTask {
    id: string;
    title: string;
    state: "active" | "completed";
    dueAt: number | null;
    timezone: string;
    sourceNoteId: string | null;
    sourceUrl: string | null;
}

export const noteTasksApi = {
    createTaskFromNote: (id: string, input: { title: string; due?: string | null; timezone?: string }) =>
        apiRequest<{ task: LinkedNoteTask; created: boolean }>(`${API_ENDPOINTS.USER_NOTES}/${encodeURIComponent(id)}/task`, {
            method: "POST",
            body: input,
        }),
};
