import { apiRequest } from './core';

import type { SubmissionCategoryInput, SubmissionCategoryData } from '@zeffuro/fakegaming-common/api';

export type { SubmissionCategoryInput };
export type SubmissionCategory = SubmissionCategoryData;

export interface SubmissionOptions {
    channels: { id: string; name: string; type: number }[];
    roles: { id: string; name: string; managed: boolean }[];
}

const path = (guildId: string) => `/api/external/submissions/${encodeURIComponent(guildId)}`;

export const submissionsApi = {
    list: (guildId: string) => apiRequest<SubmissionCategory[]>(`${path(guildId)}/categories`),
    options: (guildId: string) => apiRequest<SubmissionOptions>(`${path(guildId)}/options`),
    create: (guildId: string, input: SubmissionCategoryInput) =>
        apiRequest<SubmissionCategory>(`${path(guildId)}/categories`, { method: 'POST', body: input }),
    update: (guildId: string, id: string, input: SubmissionCategoryInput, expectedVersion: number) =>
        apiRequest<SubmissionCategory>(`${path(guildId)}/categories/${encodeURIComponent(id)}`, {
            method: 'PUT', body: { ...input, expectedVersion },
        }),
};
