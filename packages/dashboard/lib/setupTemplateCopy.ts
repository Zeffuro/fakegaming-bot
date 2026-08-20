import type { DashboardMessageKey } from "@/lib/i18n/messages";

const templateNameKeys = {
    "streamer-alerts": "setupTemplates.template.streamerAlerts.name",
    "patch-notes": "setupTemplates.template.patchNotes.name",
    "anime-club": "setupTemplates.template.animeClub.name",
    "gaming-community": "setupTemplates.template.gamingCommunity.name",
} as const satisfies Record<string, DashboardMessageKey>;

const templateDescriptionKeys = {
    "streamer-alerts": "setupTemplates.template.streamerAlerts.description",
    "patch-notes": "setupTemplates.template.patchNotes.description",
    "anime-club": "setupTemplates.template.animeClub.description",
    "gaming-community": "setupTemplates.template.gamingCommunity.description",
} as const satisfies Record<string, DashboardMessageKey>;

const channelSlotLabelKeys = {
    live: "setupTemplates.channel.live.label",
    videos: "setupTemplates.channel.videos.label",
    patches: "setupTemplates.channel.patches.label",
    anime: "setupTemplates.channel.anime.label",
    steamNews: "setupTemplates.channel.steamNews.label",
} as const satisfies Record<string, DashboardMessageKey>;

const channelSlotDescriptionKeys = {
    live: "setupTemplates.channel.live.description",
    videos: "setupTemplates.channel.videos.description",
    patches: "setupTemplates.channel.patches.description",
    anime: "setupTemplates.channel.anime.description",
    steamNews: "setupTemplates.channel.steamNews.description",
} as const satisfies Record<string, DashboardMessageKey>;

const inputGroupLabelKeys = {
    twitchUsernames: "setupTemplates.input.twitchUsernames.label",
    youtubeChannelIds: "setupTemplates.input.youtubeChannelIds.label",
    patchGames: "setupTemplates.input.patchGames.label",
    animeIds: "setupTemplates.input.animeIds.label",
    steamApps: "setupTemplates.input.steamApps.label",
} as const satisfies Record<string, DashboardMessageKey>;

const inputGroupDescriptionKeys = {
    twitchUsernames: "setupTemplates.input.twitchUsernames.description",
    youtubeChannelIds: "setupTemplates.input.youtubeChannelIds.description",
    patchGames: "setupTemplates.input.patchGames.description",
    animeIds: "setupTemplates.input.animeIds.description",
    steamApps: "setupTemplates.input.steamApps.description",
} as const satisfies Record<string, DashboardMessageKey>;

const inputGroupPlaceholderKeys = {
    twitchUsernames: "setupTemplates.input.twitchUsernames.placeholder",
    youtubeChannelIds: "setupTemplates.input.youtubeChannelIds.placeholder",
    patchGames: "setupTemplates.input.patchGames.placeholder",
    animeIds: "setupTemplates.input.animeIds.placeholder",
    steamApps: "setupTemplates.input.steamApps.placeholder",
} as const satisfies Record<string, DashboardMessageKey>;

const providerKeys = {
    Twitch: "setupTemplates.provider.twitch",
    YouTube: "setupTemplates.provider.youtube",
    "Patch Notes": "setupTemplates.provider.patchNotes",
    Anime: "setupTemplates.provider.anime",
    "Steam News": "setupTemplates.provider.steamNews",
} as const satisfies Record<string, DashboardMessageKey>;

const findingKeys = {
    "Record is missing a provider, source, or Discord channel.": "setupTemplates.finding.missingRecordFields",
    "This provider/source/channel route already exists.": "setupTemplates.finding.duplicateRoute",
    "This provider/source already exists in this server; applying would update its channel.": "setupTemplates.finding.duplicateSource",
    "Twitch username is required.": "setupTemplates.finding.twitchUsernameRequired",
    "YouTube templates require a channel ID beginning with UC.": "setupTemplates.finding.youtubeChannelId",
    "Patch-note game is required.": "setupTemplates.finding.patchGameRequired",
    "AniList ID must be a positive whole number.": "setupTemplates.finding.anilistId",
    "Steam app ID must be a positive whole number.": "setupTemplates.finding.steamAppId",
    "Live Alerts Channel is required for Twitch.": "setupTemplates.finding.liveChannelRequired",
    "Video Alerts Channel is required for YouTube.": "setupTemplates.finding.videoChannelRequired",
    "Patch Notes Channel is required for Patch Notes.": "setupTemplates.finding.patchChannelRequired",
    "Anime Channel is required for Anime.": "setupTemplates.finding.animeChannelRequired",
    "Steam News Channel is required for Steam News.": "setupTemplates.finding.steamNewsChannelRequired",
} as const satisfies Record<string, DashboardMessageKey>;

const warningKeys = {
    "Add at least one template input before applying this setup.": "setupTemplates.warning.addInput",
} as const satisfies Record<string, DashboardMessageKey>;

const findingIdKeys = {
    missingRecordFields: "setupTemplates.finding.missingRecordFields",
    duplicateRoute: "setupTemplates.finding.duplicateRoute",
    duplicateSource: "setupTemplates.finding.duplicateSource",
    twitchUsernameRequired: "setupTemplates.finding.twitchUsernameRequired",
    youtubeChannelId: "setupTemplates.finding.youtubeChannelId",
    patchGameRequired: "setupTemplates.finding.patchGameRequired",
    anilistId: "setupTemplates.finding.anilistId",
    steamAppId: "setupTemplates.finding.steamAppId",
    liveChannelRequired: "setupTemplates.finding.liveChannelRequired",
    videoChannelRequired: "setupTemplates.finding.videoChannelRequired",
    patchChannelRequired: "setupTemplates.finding.patchChannelRequired",
    animeChannelRequired: "setupTemplates.finding.animeChannelRequired",
    steamNewsChannelRequired: "setupTemplates.finding.steamNewsChannelRequired",
} as const satisfies Record<string, DashboardMessageKey>;

const warningIdKeys = {
    addInput: "setupTemplates.warning.addInput",
} as const satisfies Record<string, DashboardMessageKey>;

function getKey(map: Record<string, DashboardMessageKey>, value: string): DashboardMessageKey | null {
    return map[value] ?? null;
}

export function getSetupTemplateNameKey(templateId: string): DashboardMessageKey | null {
    return getKey(templateNameKeys, templateId);
}

export function getSetupTemplateDescriptionKey(templateId: string): DashboardMessageKey | null {
    return getKey(templateDescriptionKeys, templateId);
}

export function getSetupTemplateChannelSlotLabelKey(slotKey: string): DashboardMessageKey | null {
    return getKey(channelSlotLabelKeys, slotKey);
}

export function getSetupTemplateChannelSlotDescriptionKey(slotKey: string): DashboardMessageKey | null {
    return getKey(channelSlotDescriptionKeys, slotKey);
}

export function getSetupTemplateInputGroupLabelKey(groupKey: string): DashboardMessageKey | null {
    return getKey(inputGroupLabelKeys, groupKey);
}

export function getSetupTemplateInputGroupDescriptionKey(groupKey: string): DashboardMessageKey | null {
    return getKey(inputGroupDescriptionKeys, groupKey);
}

export function getSetupTemplateInputGroupPlaceholderKey(groupKey: string): DashboardMessageKey | null {
    return getKey(inputGroupPlaceholderKeys, groupKey);
}

export function getSetupTemplateProviderKey(provider: string): DashboardMessageKey | null {
    return getKey(providerKeys, provider);
}

export function getSetupTemplateFindingKey(message: string): DashboardMessageKey | null {
    return getKey(findingKeys, message);
}

export function getSetupTemplateWarningKey(message: string): DashboardMessageKey | null {
    return getKey(warningKeys, message);
}

export function getSetupTemplateFindingIdKey(findingId: string): DashboardMessageKey | null {
    return getKey(findingIdKeys, findingId);
}

export function getSetupTemplateWarningIdKey(warningId: string): DashboardMessageKey | null {
    return getKey(warningIdKeys, warningId);
}
