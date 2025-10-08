import { vi } from 'vitest';
import type {
    BirthdayConfig,
    ReminderConfig,
    TwitchStreamConfig,
    YoutubeVideoConfig,
    QuoteConfig,
    UserConfig,
    LeagueConfig,
    PatchNoteConfig,
    PatchSubscriptionConfig,
    DisabledCommandConfig
} from '../../models/index.js';

/**
 * Creates a mock birthday with default values
 */
export function createMockBirthday(overrides: Partial<BirthdayConfig> = {}): BirthdayConfig {
    const today = new Date();
    return {
        id: 'birthday-123',
        userId: 'user-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: 2000,
        ...overrides
    } as BirthdayConfig;
}

/**
 * Creates a mock reminder with default values
 */
export function createMockReminder(overrides: Partial<ReminderConfig> = {}): ReminderConfig {
    return {
        id: 'reminder-123',
        userId: 'user-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        message: 'Test reminder',
        timestamp: Date.now() + 3600000, // 1 hour in the future
        timespan: '1h',
        ...overrides
    } as ReminderConfig;
}

/**
 * Creates a mock Twitch stream with default values
 */
export function createMockTwitchStream(overrides: Partial<TwitchStreamConfig> = {}): TwitchStreamConfig & { save?: () => Promise<any> } {
    const stream = {
        id: 'twitch-123',
        twitchUsername: 'teststreamer',
        discordChannelId: 'channel-123',
        guildId: 'guild-123',
        lastAnnounceDate: Date.now() - 86400000, // 1 day ago
        isLive: false,
        streamTitle: 'Test Stream',
        customMessage: 'Now streaming!',
        save: vi.fn(async function(this: any) { return this; }),
        ...overrides
    };
    return stream as TwitchStreamConfig & { save: () => Promise<any> };
}

/**
 * Creates a mock YouTube channel with default values
 */
export function createMockYoutubeChannel(overrides: Partial<YoutubeVideoConfig> = {}): YoutubeVideoConfig {
    return {
        id: 'youtube-123',
        youtubeChannelId: 'UC123456789',
        discordChannelId: 'channel-123',
        guildId: 'guild-123',
        lastVideoId: 'video123',
        lastAnnounceDate: Date.now() - 86400000, // 1 day ago
        customMessage: 'New video!',
        ...overrides
    } as YoutubeVideoConfig;
}

/**
 * Creates a mock Quote with default values
 */
export function createMockQuote(overrides: Partial<QuoteConfig> = {}): QuoteConfig {
    return {
        id: 'quote-123',
        guildId: 'guild-123',
        quote: 'Test quote',
        authorId: 'author-123',
        addedBy: 'user-123',
        timestamp: Date.now() - 86400000, // 1 day ago
        ...overrides
    } as QuoteConfig;
}

/**
 * Creates a mock League data with default values
 */
export function createMockLeague(overrides: Partial<LeagueConfig> = {}): LeagueConfig {
    return {
        id: 1,
        summonerId: 'summoner-123',
        accountId: 'account-123',
        puuid: 'puuid-123',
        region: 'euw1',
        name: 'TestSummoner',
        ...overrides
    } as LeagueConfig;
}

/**
 * Creates a mock user with league info
 */
export function createMockUserWithLeague(overrides: Partial<UserConfig> = {}): UserConfig & { league?: LeagueConfig } {
    return {
        id: 'user-123',
        discordId: 'discord-123',
        timezone: 'Europe/Berlin',
        league: createMockLeague(),
        ...overrides
    } as UserConfig & { league?: LeagueConfig };
}

/**
 * Creates a mock patch note with default values
 */
export function createMockPatchNote(overrides: Partial<PatchNoteConfig> = {}): PatchNoteConfig {
    return {
        id: 'patch-123',
        game: 'Test Game',
        title: 'Version 1.2.3',
        content: 'Test patch note content',
        url: 'https://example.com/patch',
        date: new Date(),
        publishedAt: new Date(), // Assuming publishedAt is used, based on patchNotesService.ts
        ...overrides
    } as PatchNoteConfig;
}

/**
 * Creates a mock patch subscription with default values
 */
export function createMockPatchSubscription(overrides: Partial<PatchSubscriptionConfig> = {}): PatchSubscriptionConfig {
    return {
        id: 'patchsub-123',
        game: 'Test Game',
        channelId: 'channel-123',
        guildId: 'guild-123',
        lastAnnouncedAt: new Date(Date.now() - 86400000), // 1 day ago
        ...overrides
    } as PatchSubscriptionConfig;
}

/**
 * Creates a mock disabled command with default values
 */
export function createMockDisabledCommand(overrides: Partial<DisabledCommandConfig> = {}): DisabledCommandConfig {
    return {
        id: 'disabled-123',
        guildId: 'guild-123',
        commandId: 'command-123',
        ...overrides
    } as DisabledCommandConfig;
}

/**
 * Wrapper to create a mock model instance with a .get() method and other instance methods.
 * This fixes the 'patchNote.get is not a function' error.
 */
function createModelInstanceMock(data: any): any {
    return {
        ...data,
        // Mock the Sequelize instance method .get()
        get: vi.fn().mockImplementation((options?: { raw: boolean }) => {
            // Sequelize .get() with { raw: true } returns the data values
            if (options?.raw) {
                return data;
            }
            // otherwise returns the data values (or the instance itself for a more complete mock)
            return data;
        }),
        // Add other common instance methods if needed, though get() is the immediate fix
        save: vi.fn().mockResolvedValue(data),
        reload: vi.fn().mockResolvedValue(data),
        destroy: vi.fn().mockResolvedValue(undefined),
    };
}

/**
 * Creates a common mock object for Sequelize models (static methods)
 * @param createDefaultData
 * @param defaultId The default ID to return on 'create'
 * @returns A mock object with common static methods
 */
function createCommonModelMocks(createDefaultData: () => any, defaultId: string | number) {
    return {
        // findAll returns an array of mock instances
        findAll: vi.fn().mockImplementation(async (_options) => {
            // Use the provided default data function to get a mock instance with the correct types
            const defaultMock = createDefaultData();
            return [createModelInstanceMock(defaultMock)];
        }),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve(createModelInstanceMock({ ...data, id: defaultId }))),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1),
        build: vi.fn().mockImplementation((data) => createModelInstanceMock({ ...data })),
    };
}

/**
 * Setup mocks for Sequelize models
 */
export function setupModelMocks(): void {
    // Mock the models from the common package
    vi.mock('../../models', async (importOriginal: () => Promise<typeof import('../../models/index.js')>) => {
        const actualModels = await importOriginal();

        const mockModels = {
            BirthdayConfig: createCommonModelMocks(createMockBirthday, 'birthday-123'),
            ReminderConfig: createCommonModelMocks(createMockReminder, 'reminder-123'),
            TwitchStreamConfig: createCommonModelMocks(createMockTwitchStream, 'twitch-123'),
            YoutubeVideoConfig: createCommonModelMocks(createMockYoutubeChannel, 'youtube-123'),
            QuoteConfig: createCommonModelMocks(createMockQuote, 'quote-123'),
            UserConfig: createCommonModelMocks(createMockUserWithLeague, 'user-123'),
            LeagueConfig: createCommonModelMocks(createMockLeague, 1),
            PatchNoteConfig: createCommonModelMocks(createMockPatchNote, 'patch-123'),
            PatchSubscriptionConfig: createCommonModelMocks(createMockPatchSubscription, 'patchsub-123'),
            DisabledCommandConfig: createCommonModelMocks(createMockDisabledCommand, 'disabled-123'),
        };

        return {
            ...actualModels,
            ...mockModels
        };
    });
}