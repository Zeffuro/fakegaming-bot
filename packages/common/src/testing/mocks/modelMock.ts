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
    timezone: 'UTC',
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
export function createMockTwitchStream(overrides: Partial<TwitchStreamConfig> = {}): TwitchStreamConfig {
  return {
    id: 'twitch-123',
    twitchUsername: 'teststreamer',
    discordChannelId: 'channel-123',
    guildId: 'guild-123',
    lastAnnounceDate: Date.now() - 86400000, // 1 day ago
    isLive: false,
    streamTitle: 'Test Stream',
    customMessage: 'Now streaming!',
    ...overrides
  } as TwitchStreamConfig;
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
 * Setup mocks for Sequelize models
 */
export function setupModelMocks(): void {
  // Mock the models from the common package
  vi.mock('../../models', async (importOriginal: () => Promise<typeof import('../../models/index.js')>) => {
    const actualModels = await importOriginal();

    const mockModels = {
      BirthdayConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'birthday-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      ReminderConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'reminder-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      TwitchStreamConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'twitch-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      YoutubeVideoConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'youtube-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      QuoteConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'quote-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      UserConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'user-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      LeagueConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 1 })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      PatchNoteConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'patch-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      PatchSubscriptionConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'patchsub-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
      DisabledCommandConfig: {
        findAll: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'disabled-123' })),
        update: vi.fn().mockResolvedValue([1]),
        destroy: vi.fn().mockResolvedValue(1)
      },
    };

    return {
      ...actualModels,
      ...mockModels
    };
  });
}
