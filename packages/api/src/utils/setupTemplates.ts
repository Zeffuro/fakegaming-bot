import type { CreationAttributes } from 'sequelize';
import type {
    AnimeSubscriptionConfig,
    ConfigManager,
    PatchSubscriptionConfig,
    SteamNewsSubscriptionConfig,
    TwitchStreamConfig,
    YoutubeVideoConfig,
} from '@zeffuro/fakegaming-common';

export type SetupTemplateId = 'streamer-alerts' | 'patch-notes' | 'anime-club' | 'gaming-community';
export type SetupTemplateProvider = 'Twitch' | 'YouTube' | 'Patch Notes' | 'Anime' | 'Steam News';
export type SetupTemplateSkipReason = 'duplicate' | 'unsupported' | 'invalid';
export type SetupTemplateChannelSlotKey = 'live' | 'videos' | 'patches' | 'anime' | 'steamNews';
export type SetupTemplateInputGroupKey = 'twitchUsernames' | 'youtubeChannelIds' | 'patchGames' | 'animeIds' | 'steamApps';

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

interface TemplateRecordCandidate {
    record: SetupTemplateRecord;
}

const channelSlots: Record<SetupTemplateChannelSlotKey, SetupTemplateChannelSlot> = {
    live: {
        key: 'live',
        label: 'Live Alerts Channel',
        description: 'Destination for Twitch live alerts.',
    },
    videos: {
        key: 'videos',
        label: 'Video Alerts Channel',
        description: 'Destination for YouTube upload alerts.',
    },
    patches: {
        key: 'patches',
        label: 'Patch Notes Channel',
        description: 'Destination for game patch notes.',
    },
    anime: {
        key: 'anime',
        label: 'Anime Channel',
        description: 'Destination for anime episode reminders.',
    },
    steamNews: {
        key: 'steamNews',
        label: 'Steam News Channel',
        description: 'Destination for official Steam news posts.',
    },
};

const inputGroups: Record<SetupTemplateInputGroupKey, SetupTemplateInputGroup> = {
    twitchUsernames: {
        key: 'twitchUsernames',
        label: 'Twitch Usernames',
        description: 'Twitch logins to announce when they go live.',
        placeholder: 'riotgames\ncohhcarnage',
    },
    youtubeChannelIds: {
        key: 'youtubeChannelIds',
        label: 'YouTube Channel IDs',
        description: 'YouTube channel IDs beginning with UC.',
        placeholder: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    },
    patchGames: {
        key: 'patchGames',
        label: 'Patch Note Games',
        description: 'Game names supported by the patch-note feed.',
        placeholder: 'League of Legends\nValorant',
    },
    animeIds: {
        key: 'animeIds',
        label: 'AniList IDs',
        description: 'AniList numeric IDs for shows to track.',
        placeholder: '154587\n170942',
    },
    steamApps: {
        key: 'steamApps',
        label: 'Steam Apps',
        description: 'Steam app IDs with optional names.',
        placeholder: '730: Counter-Strike 2\n570: Dota 2',
    },
};

const setupTemplates: SetupTemplateDefinition[] = [
    {
        id: 'streamer-alerts',
        name: 'Streamer Alerts',
        description: 'Create live and upload routes for creators your server follows.',
        channelSlots: [channelSlots.live, channelSlots.videos],
        inputGroups: [inputGroups.twitchUsernames, inputGroups.youtubeChannelIds],
    },
    {
        id: 'patch-notes',
        name: 'Patch Notes',
        description: 'Create a focused patch-note channel for the games your server plays.',
        channelSlots: [channelSlots.patches],
        inputGroups: [inputGroups.patchGames],
    },
    {
        id: 'anime-club',
        name: 'Anime Club',
        description: 'Create anime episode reminders for a shared watch channel.',
        channelSlots: [channelSlots.anime],
        inputGroups: [inputGroups.animeIds],
    },
    {
        id: 'gaming-community',
        name: 'Gaming Community',
        description: 'Combine creator alerts, patch notes, anime reminders, and Steam news routes.',
        channelSlots: [channelSlots.live, channelSlots.videos, channelSlots.patches, channelSlots.anime, channelSlots.steamNews],
        inputGroups: [
            inputGroups.twitchUsernames,
            inputGroups.youtubeChannelIds,
            inputGroups.patchGames,
            inputGroups.animeIds,
            inputGroups.steamApps,
        ],
    },
];

const youtubeChannelIdPattern = /^UC[\w-]{22}$/;
const sourceUniqueProviders = new Set<SetupTemplateProvider>(['Twitch', 'YouTube']);

export function listSetupTemplateDefinitions(): SetupTemplateDefinition[] {
    return setupTemplates;
}

export function getSetupTemplateDefinition(templateId: string): SetupTemplateDefinition | null {
    return setupTemplates.find(template => template.id === templateId) ?? null;
}

export async function previewSetupTemplate(
    configManager: ConfigManager,
    templateId: string,
    request: SetupTemplateRequest
): Promise<SetupTemplatePlan | null> {
    const template = getSetupTemplateDefinition(templateId);
    if (!template) return null;

    const existingRecords = await getExistingSetupTemplateRecords(configManager, request.guildId);
    return buildSetupTemplatePlan(template, request, existingRecords);
}

export async function applySetupTemplate(
    configManager: ConfigManager,
    templateId: string,
    request: SetupTemplateRequest
): Promise<SetupTemplateApplyResult | null> {
    const plan = await previewSetupTemplate(configManager, templateId, request);
    if (!plan) return null;

    let applied = 0;
    for (const item of plan.ready) {
        await applySetupTemplateRecord(configManager, request.guildId, item.record);
        applied += 1;
    }

    return {
        ...plan,
        applied,
    };
}

async function getExistingSetupTemplateRecords(
    configManager: ConfigManager,
    guildId: string
): Promise<SetupTemplateRecord[]> {
    const [twitch, youtube, patchNotes, anime, steamNews] = await Promise.all([
        configManager.twitchManager.getManyPlain({ guildId }),
        configManager.youtubeManager.getManyPlain({ guildId }),
        configManager.patchSubscriptionManager.getManyPlain({ guildId }),
        configManager.animeManager.subscriptions.getGuildChannelSubscriptions(guildId),
        configManager.steamNewsSubscriptionManager.getManyPlain({ guildId }),
    ]);

    return [
        ...twitch.flatMap(toExistingTwitchRecord),
        ...youtube.flatMap(toExistingYouTubeRecord),
        ...patchNotes.flatMap(toExistingPatchRecord),
        ...anime.flatMap(toExistingAnimeRecord),
        ...steamNews.flatMap(toExistingSteamNewsRecord),
    ];
}

function buildSetupTemplatePlan(
    template: SetupTemplateDefinition,
    request: SetupTemplateRequest,
    existingRecords: SetupTemplateRecord[]
): SetupTemplatePlan {
    const built = buildTemplateRecords(template, request);
    const ready: SetupTemplateItem[] = [];
    const skipped: SetupTemplateSkippedItem[] = [...built.skipped];
    const seenRouteKeys = new Set(existingRecords.map(getSetupTemplateRouteKey).filter(isPresent));
    const seenSourceKeys = new Set(existingRecords.map(getSetupTemplateSourceKey).filter(isPresent));
    const warnings: string[] = [];

    for (const candidate of built.candidates) {
        const routeKey = getSetupTemplateRouteKey(candidate.record);
        if (!routeKey) {
            skipped.push({
                key: `invalid:${skipped.length}`,
                record: candidate.record,
                reason: 'invalid',
                message: 'Record is missing a provider, source, or Discord channel.',
            });
            continue;
        }

        if (seenRouteKeys.has(routeKey)) {
            skipped.push({
                key: routeKey,
                record: candidate.record,
                reason: 'duplicate',
                message: 'This provider/source/channel route already exists.',
            });
            continue;
        }

        const sourceKey = getSetupTemplateSourceKey(candidate.record);
        if (sourceKey && seenSourceKeys.has(sourceKey)) {
            skipped.push({
                key: routeKey,
                record: candidate.record,
                reason: 'duplicate',
                message: 'This provider/source already exists in this server; applying would update its channel.',
            });
            continue;
        }

        seenRouteKeys.add(routeKey);
        if (sourceKey) seenSourceKeys.add(sourceKey);
        ready.push({ key: routeKey, record: candidate.record });
    }

    if (ready.length === 0 && skipped.length === 0) {
        warnings.push('Add at least one template input before applying this setup.');
    }

    return {
        currentGuildId: request.guildId,
        ready,
        skipped,
        template,
        totals: {
            records: ready.length + skipped.length,
            ready: ready.length,
            duplicate: countSkipped(skipped, 'duplicate'),
            invalid: countSkipped(skipped, 'invalid'),
            unsupported: countSkipped(skipped, 'unsupported'),
        },
        warnings,
    };
}

function buildTemplateRecords(
    template: SetupTemplateDefinition,
    request: SetupTemplateRequest
): { candidates: TemplateRecordCandidate[]; skipped: SetupTemplateSkippedItem[] } {
    const candidates: TemplateRecordCandidate[] = [];
    const skipped: SetupTemplateSkippedItem[] = [];

    if (hasInputGroup(template, 'twitchUsernames')) {
        for (const username of request.inputs?.twitchUsernames ?? []) {
            const source = normalizeString(username);
            if (!source) {
                pushInvalid(skipped, 'Twitch', 'Invalid Twitch username', channelFor(request, 'live'), 'Twitch username is required.');
                continue;
            }
            pushCandidate(candidates, skipped, request, 'live', {
                provider: 'Twitch',
                source,
                sourceId: source,
                paused: false,
            });
        }
    }

    if (hasInputGroup(template, 'youtubeChannelIds')) {
        for (const channelId of request.inputs?.youtubeChannelIds ?? []) {
            const source = normalizeString(channelId);
            if (!source || !youtubeChannelIdPattern.test(source)) {
                pushInvalid(skipped, 'YouTube', source ?? 'Invalid YouTube channel', channelFor(request, 'videos'), 'YouTube templates require a channel ID beginning with UC.');
                continue;
            }
            pushCandidate(candidates, skipped, request, 'videos', {
                provider: 'YouTube',
                source,
                sourceId: source,
                paused: false,
            });
        }
    }

    if (hasInputGroup(template, 'patchGames')) {
        for (const game of request.inputs?.patchGames ?? []) {
            const source = normalizeString(game);
            if (!source) {
                pushInvalid(skipped, 'Patch Notes', 'Invalid patch game', channelFor(request, 'patches'), 'Patch-note game is required.');
                continue;
            }
            pushCandidate(candidates, skipped, request, 'patches', {
                provider: 'Patch Notes',
                source,
                sourceId: source,
                paused: false,
            });
        }
    }

    if (hasInputGroup(template, 'animeIds')) {
        for (const animeId of request.inputs?.animeIds ?? []) {
            if (!Number.isInteger(animeId) || animeId <= 0) {
                pushInvalid(skipped, 'Anime', 'Invalid AniList ID', channelFor(request, 'anime'), 'AniList ID must be a positive whole number.');
                continue;
            }
            pushCandidate(candidates, skipped, request, 'anime', {
                provider: 'Anime',
                source: `AniList #${animeId}`,
                sourceId: String(animeId),
                reminderMinutes: 30,
                paused: false,
            });
        }
    }

    if (hasInputGroup(template, 'steamApps')) {
        for (const app of request.inputs?.steamApps ?? []) {
            if (!Number.isInteger(app.appId) || app.appId <= 0) {
                pushInvalid(skipped, 'Steam News', app.name ?? 'Invalid Steam app', channelFor(request, 'steamNews'), 'Steam app ID must be a positive whole number.');
                continue;
            }
            pushCandidate(candidates, skipped, request, 'steamNews', {
                provider: 'Steam News',
                source: normalizeString(app.name) ?? `Steam app ${app.appId}`,
                sourceId: String(app.appId),
                paused: false,
            });
        }
    }

    return { candidates, skipped };
}

function pushCandidate(
    candidates: TemplateRecordCandidate[],
    skipped: SetupTemplateSkippedItem[],
    request: SetupTemplateRequest,
    channelSlot: SetupTemplateChannelSlotKey,
    record: Omit<SetupTemplateRecord, 'channelId'>
): void {
    const channelId = channelFor(request, channelSlot);
    if (!channelId) {
        pushInvalid(
            skipped,
            record.provider,
            record.source,
            'Missing channel',
            `${channelSlots[channelSlot].label} is required for ${record.provider}.`
        );
        return;
    }

    candidates.push({
        record: {
            ...record,
            channelId,
        },
    });
}

function pushInvalid(
    skipped: SetupTemplateSkippedItem[],
    provider: SetupTemplateProvider,
    source: string,
    channelId: string | null,
    message: string
): void {
    skipped.push({
        key: `invalid:${skipped.length}`,
        record: {
            provider,
            source,
            sourceId: null,
            channelId: channelId ?? 'Missing channel',
        },
        reason: 'invalid',
        message,
    });
}

async function applySetupTemplateRecord(
    configManager: ConfigManager,
    guildId: string,
    record: SetupTemplateRecord
): Promise<void> {
    if (record.provider === 'Twitch') {
        await configManager.twitchManager.addPlain({
            twitchUsername: record.source,
            discordChannelId: record.channelId,
            guildId,
            ...buildTimingPayload(record),
            isLive: false,
        } as CreationAttributes<TwitchStreamConfig>);
        return;
    }

    if (record.provider === 'YouTube') {
        await configManager.youtubeManager.addPlain({
            youtubeChannelId: getRecordIdentity(record),
            discordChannelId: record.channelId,
            guildId,
            ...buildTimingPayload(record),
        } as CreationAttributes<YoutubeVideoConfig>);
        return;
    }

    if (record.provider === 'Patch Notes') {
        await configManager.patchSubscriptionManager.addPlain({
            game: record.source,
            channelId: record.channelId,
            guildId,
            paused: Boolean(record.paused),
        } as CreationAttributes<PatchSubscriptionConfig>);
        return;
    }

    if (record.provider === 'Anime') {
        await configManager.animeManager.subscriptions.subscribeChannel({
            anilistId: Number(getRecordIdentity(record)),
            guildId,
            channelId: record.channelId,
            reminderMinutes: normalizeReminderMinutes(record.reminderMinutes),
        });
        return;
    }

    if (record.provider === 'Steam News') {
        await configManager.steamNewsSubscriptionManager.addPlain({
            steamAppId: Number(getRecordIdentity(record)),
            appName: record.source,
            discordChannelId: record.channelId,
            guildId,
            ...buildTimingPayload(record),
        } as CreationAttributes<SteamNewsSubscriptionConfig>);
    }
}

function toExistingTwitchRecord(record: CreationAttributes<TwitchStreamConfig>): SetupTemplateRecord[] {
    const source = normalizeString(record.twitchUsername);
    const channelId = normalizeString(record.discordChannelId);
    if (!source || !channelId) return [];

    return [{
        provider: 'Twitch',
        source,
        sourceId: source,
        channelId,
        paused: Boolean(record.paused),
    }];
}

function toExistingYouTubeRecord(record: CreationAttributes<YoutubeVideoConfig>): SetupTemplateRecord[] {
    const source = normalizeString(record.youtubeChannelId);
    const channelId = normalizeString(record.discordChannelId);
    if (!source || !channelId) return [];

    return [{
        provider: 'YouTube',
        source,
        sourceId: source,
        channelId,
        paused: Boolean(record.paused),
    }];
}

function toExistingPatchRecord(record: CreationAttributes<PatchSubscriptionConfig>): SetupTemplateRecord[] {
    const source = normalizeString(record.game);
    const channelId = normalizeString(record.channelId);
    if (!source || !channelId) return [];

    return [{
        provider: 'Patch Notes',
        source,
        sourceId: source,
        channelId,
        paused: Boolean(record.paused),
    }];
}

function toExistingAnimeRecord(record: CreationAttributes<AnimeSubscriptionConfig>): SetupTemplateRecord[] {
    const sourceId = normalizeString(record.anilistId);
    const channelId = normalizeString(record.channelId);
    if (!sourceId || !channelId) return [];

    return [{
        provider: 'Anime',
        source: `AniList #${sourceId}`,
        sourceId,
        channelId,
        paused: Boolean(record.paused),
        reminderMinutes: normalizeReminderMinutes(record.reminderMinutes),
    }];
}

function toExistingSteamNewsRecord(record: CreationAttributes<SteamNewsSubscriptionConfig>): SetupTemplateRecord[] {
    const sourceId = normalizeString(record.steamAppId);
    const channelId = normalizeString(record.discordChannelId);
    if (!sourceId || !channelId) return [];

    return [{
        provider: 'Steam News',
        source: normalizeString(record.appName) ?? `Steam app ${sourceId}`,
        sourceId,
        channelId,
        paused: Boolean(record.paused),
    }];
}

function buildTimingPayload(record: SetupTemplateRecord): {
    cooldownMinutes?: number | null;
    customMessage?: string;
    paused: boolean;
    quietHoursEnd?: string | null;
    quietHoursStart?: string | null;
} {
    return {
        ...(record.customMessage ? { customMessage: record.customMessage } : {}),
        cooldownMinutes: record.cooldownMinutes ?? null,
        quietHoursStart: record.quietHoursStart ?? null,
        quietHoursEnd: record.quietHoursEnd ?? null,
        paused: Boolean(record.paused),
    };
}

function getSetupTemplateRouteKey(record: SetupTemplateRecord): string | null {
    const provider = normalizeString(record.provider);
    const source = normalizeString(getRecordIdentity(record));
    const channelId = normalizeString(record.channelId);
    if (!provider || !source || !channelId) return null;
    return `${provider.toLowerCase()}:${source.toLowerCase()}:${channelId}`;
}

function getSetupTemplateSourceKey(record: SetupTemplateRecord): string | null {
    if (!sourceUniqueProviders.has(record.provider)) return null;
    const source = normalizeString(getRecordIdentity(record));
    if (!source) return null;
    return `${record.provider.toLowerCase()}:${source.toLowerCase()}`;
}

function getRecordIdentity(record: SetupTemplateRecord): string {
    return normalizeString(record.sourceId) ?? record.source;
}

function channelFor(request: SetupTemplateRequest, slot: SetupTemplateChannelSlotKey): string | null {
    return normalizeString(request.channels[slot]);
}

function hasInputGroup(template: SetupTemplateDefinition, key: SetupTemplateInputGroupKey): boolean {
    return template.inputGroups.some(group => group.key === key);
}

function countSkipped(skipped: SetupTemplateSkippedItem[], reason: SetupTemplateSkipReason): number {
    return skipped.filter(item => item.reason === reason).length;
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeReminderMinutes(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440 ? value : 30;
}

function isPresent<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}
