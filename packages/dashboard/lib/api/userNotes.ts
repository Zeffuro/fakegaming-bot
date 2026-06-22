import { API_ENDPOINTS, apiRequest } from "./core";

export interface UserNote {
    id: string;
    discordId: string;
    title: string;
    body: string;
    pinned: boolean;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface UserNoteListResponse {
    notes: UserNote[];
}

export interface UserNoteInput {
    title?: string;
    body?: string;
    pinned?: boolean;
}

export interface UserNoteUpdateInput {
    title?: string;
    body?: string;
    pinned?: boolean;
}

export const userNotesApi = {
    listUserNotes: () =>
        apiRequest<UserNoteListResponse>(API_ENDPOINTS.USER_NOTES),

    createUserNote: (input: UserNoteInput) =>
        apiRequest<UserNote>(API_ENDPOINTS.USER_NOTES, {
            method: "POST",
            body: input,
        }),

    updateUserNote: (id: string, input: UserNoteUpdateInput) =>
        apiRequest<UserNote>(`${API_ENDPOINTS.USER_NOTES}/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: input,
        }),

    deleteUserNote: (id: string) =>
        apiRequest<{ success: boolean }>(`${API_ENDPOINTS.USER_NOTES}/${encodeURIComponent(id)}`, {
            method: "DELETE",
        }),
};
