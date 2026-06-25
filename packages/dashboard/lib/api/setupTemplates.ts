import { API_ENDPOINTS, apiRequest } from "./core";

export type SetupTemplateId = "streamer-alerts" | "patch-notes" | "anime-club" | "gaming-community";
export type SetupTemplateProvider = "Twitch" | "YouTube" | "Patch Notes" | "Anime" | "Steam News";
export type SetupTemplateSkipReason = "duplicate" | "unsupported" | "invalid";
export type SetupTemplateChannelSlotKey = "live" | "videos" | "patches" | "anime" | "steamNews";
export type SetupTemplateInputGroupKey = "twitchUsernames" | "youtubeChannelIds" | "patchGames" | "animeIds" | "steamApps";

export interface SetupTemplateChannelSlot {
    key: SetupTemplateChannelSlotKey;
    label: string;
    description: string;
}

export interface SetupTemplateInputGroup {
    key: SetupTemplateInputGroupKey;
    label: string;
    description: string;
    placeholder: string;
}

export interface SetupTemplateDefinition {
    id: SetupTemplateId;
    name: string;
    description: string;
    channelSlots: SetupTemplateChannelSlot[];
    inputGroups: SetupTemplateInputGroup[];
}

export interface SetupTemplateSteamAppInput {
    appId: number;
    name?: string | null;
}

export interface SetupTemplateRequest {
    guildId: string;
    channels: Partial<Record<SetupTemplateChannelSlotKey, string>>;
    inputs?: {
        animeIds?: number[];
        patchGames?: string[];
        steamApps?: SetupTemplateSteamAppInput[];
        twitchUsernames?: string[];
        youtubeChannelIds?: string[];
    };
}

export interface SetupTemplateRecord {
    provider: SetupTemplateProvider;
    source: string;
    sourceId?: string | null;
    channelId: string;
    paused?: boolean | null;
    customMessage?: string | null;
    cooldownMinutes?: number | null;
    reminderMinutes?: number | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
}

export interface SetupTemplateItem {
    key: string;
    record: SetupTemplateRecord;
}

export interface SetupTemplateSkippedItem extends SetupTemplateItem {
    reason: SetupTemplateSkipReason;
    message: string;
}

export interface SetupTemplatePlan {
    currentGuildId: string;
    ready: SetupTemplateItem[];
    skipped: SetupTemplateSkippedItem[];
    template: SetupTemplateDefinition;
    totals: {
        duplicate: number;
        invalid: number;
        ready: number;
        records: number;
        unsupported: number;
    };
    warnings: string[];
}

export interface SetupTemplateApplyResult extends SetupTemplatePlan {
    applied: number;
}

export const setupTemplatesApi = {
    getSetupTemplates: () =>
        apiRequest<{ templates: SetupTemplateDefinition[] }>(API_ENDPOINTS.SETUP_TEMPLATES),

    previewSetupTemplate: (templateId: string, data: SetupTemplateRequest) =>
        apiRequest<SetupTemplatePlan>(
            `${API_ENDPOINTS.SETUP_TEMPLATES}/${encodeURIComponent(templateId)}/preview`,
            { method: "POST", body: data },
        ),

    applySetupTemplate: (templateId: string, data: SetupTemplateRequest) =>
        apiRequest<SetupTemplateApplyResult>(
            `${API_ENDPOINTS.SETUP_TEMPLATES}/${encodeURIComponent(templateId)}/apply`,
            { method: "POST", body: data },
        ),
};
