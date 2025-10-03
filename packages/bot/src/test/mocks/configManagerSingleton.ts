// Mock implementation for the config manager singleton
import { jest } from '@jest/globals';

// Create mock implementations for all managers with their class constructors
export class BirthdayManager {}
export class ReminderManager {}
export class TwitchManager {}
export class YoutubeManager {}
export class QuoteManager {}
export class UserManager {}
export class LeagueManager {}
export class PatchNotesManager {}
export class PatchSubscriptionManager {}

// Create LeagueConfig class with create method
export const LeagueConfig = {
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({})
};

// Create mock data for testing
const mockBirthdays = [
    {
        id: '1',
        userId: 'user1',
        guildId: 'guild1',
        channelId: 'channel1',
        day: new Date().getDate(),
        month: new Date().getMonth() + 1,
        timezone: 'UTC'
    },
    {
        id: '2',
        userId: 'user2',
        guildId: 'guild1',
        channelId: 'channel1',
        day: new Date().getDate(),
        month: new Date().getMonth() + 1,
        timezone: 'UTC'
    }
];

const leapYearBirthday = {
    id: '3',
    userId: 'user3',
    guildId: 'guild1',
    channelId: 'channel1',
    day: 29,
    month: 2,
    timezone: 'UTC'
};

const mockReminders = [
    {
        id: '1',
        userId: 'user1',
        guildId: 'guild1',
        channelId: 'channel1',
        message: 'Test reminder',
        timestamp: Date.now() - 1000 // Past timestamp so it's due
    },
    {
        id: '2',
        userId: 'user2',
        guildId: 'guild1',
        channelId: 'channel1',
        message: 'Test reminder 2',
        timestamp: Date.now() - 1000 // Past timestamp so it's due
    }
];

const mockTwitchStreams = [
    {
        id: '1',
        twitchUsername: 'Streamer',
        discordChannelId: 'channel1',
        guildId: 'guild1',
        lastAnnounceDate: Date.now() - 86400000, // 1 day ago
        isLive: true,
        streamTitle: 'Test Stream'
    },
    {
        id: '2',
        twitchUsername: 'Streamer2',
        discordChannelId: 'channel1',
        guildId: 'guild1',
        lastAnnounceDate: Date.now() - 86400000, // 1 day ago
        isLive: true,
        streamTitle: 'Test Stream 2'
    }
];

const mockYoutubeChannels = [
    {
        id: '1',
        youtubeChannelId: 'UCTest1',
        discordChannelId: 'channel1',
        guildId: 'guild1',
        lastVideoId: 'old',
        lastAnnounceDate: Date.now() - 86400000 // 1 day ago
    },
    {
        id: '2',
        youtubeChannelId: 'UCTest2',
        discordChannelId: 'channel1',
        guildId: 'guild1',
        lastVideoId: 'old2',
        lastAnnounceDate: Date.now() - 86400000 // 1 day ago
    }
];

const mockQuotes = [
    {
        id: '1',
        guildId: 'guild1',
        quote: 'Test quote',
        authorId: 'user1',
        addedBy: 'user2',
        timestamp: Date.now() - 86400000 // 1 day ago
    },
    {
        id: '2',
        guildId: 'guild1',
        quote: 'Test quote 2',
        authorId: 'user2',
        addedBy: 'user1',
        timestamp: Date.now() - 86400000 // 1 day ago
    }
];

// Create mock managers using autoMockManager to ensure compatibility with tests
export const mockBirthdayManager = autoMockManager(BirthdayManager);
mockBirthdayManager.getAllPlain = jest.fn().mockResolvedValue([]);
mockBirthdayManager.add = jest.fn().mockResolvedValue({ id: '3' });
mockBirthdayManager.removeBirthday = jest.fn().mockResolvedValue(true);
mockBirthdayManager.getBirthday = jest.fn().mockResolvedValue(mockBirthdays[0]);
mockBirthdayManager.hasBirthday = jest.fn().mockResolvedValue(false);

export const mockReminderManager = autoMockManager(ReminderManager);
mockReminderManager.getAllPlain = jest.fn().mockResolvedValue(mockReminders);
mockReminderManager.removeReminder = jest.fn().mockResolvedValue(true);
mockReminderManager.add = jest.fn().mockResolvedValue({ id: '3' });

export const mockTwitchManager = autoMockManager(TwitchManager);
mockTwitchManager.getAllPlain = jest.fn().mockResolvedValue([]);
mockTwitchManager.streamExists = jest.fn().mockResolvedValue(false);
mockTwitchManager.add = jest.fn().mockResolvedValue({ id: '3' });
mockTwitchManager.getAll = jest.fn().mockReturnValue([]);

export const mockYoutubeManager = autoMockManager(YoutubeManager);
mockYoutubeManager.getAllPlain = jest.fn().mockResolvedValue([]);
mockYoutubeManager.add = jest.fn().mockResolvedValue({ id: '3' });
mockYoutubeManager.getVideoChannel = jest.fn().mockResolvedValue(null);
mockYoutubeManager.setVideoChannel = jest.fn().mockResolvedValue(true);

export const mockQuoteManager = autoMockManager(QuoteManager);
mockQuoteManager.getAllPlain = jest.fn().mockResolvedValue(mockQuotes);
mockQuoteManager.getQuote = jest.fn().mockResolvedValue(mockQuotes[0]);
mockQuoteManager.searchQuotes = jest.fn().mockReturnValue([mockQuotes[0]]);
mockQuoteManager.add = jest.fn().mockResolvedValue({ id: '3' });
mockQuoteManager.getQuotesByAuthor = jest.fn().mockReturnValue(mockQuotes);
mockQuoteManager.getQuotesByGuild = jest.fn().mockReturnValue(mockQuotes);

export const mockLeagueManager = autoMockManager(LeagueManager);
mockLeagueManager.getAllPlain = jest.fn().mockResolvedValue([]);

export const mockPatchManager = autoMockManager(PatchNotesManager);
mockPatchManager.getAllPlain = jest.fn().mockResolvedValue([]);
mockPatchManager.getLatestPatch = jest.fn().mockReturnValue({
    game: 'Overwatch 2',
    title: 'Patch Notes - June 2025',
    content: 'Balance changes and bug fixes.',
    url: 'https://example.com/patch',
    date: new Date()
});

export const mockUserManager = autoMockManager(UserManager);
mockUserManager.getUserWithLeague = jest.fn().mockResolvedValue({
    id: 'user1',
    discordId: 'user1',
    timezone: 'UTC',
    league: {
        id: 1,
        summonerId: 'test-summoner-id',
        accountId: 'test-account-id',
        puuid: 'test-puuid',
        region: 'euw1',
        name: 'TestSummoner',
        update: jest.fn().mockResolvedValue({})
    }
});
mockUserManager.add = jest.fn().mockResolvedValue({ id: 'user3', discordId: 'user3' });
mockUserManager.setTimezone = jest.fn().mockResolvedValue(true);

export const mockPatchSubscriptionManager = autoMockManager(PatchSubscriptionManager);
mockPatchSubscriptionManager.getAllPlain = jest.fn().mockResolvedValue([]);
mockPatchSubscriptionManager.subscribe = jest.fn().mockResolvedValue({ id: '1' });

// Create a default mock manager that can be customized by tests
export const mockConfigManager = {
    // Add all managers with proper mock implementations
    birthdayManager: mockBirthdayManager,
    reminderManager: mockReminderManager,
    twitchManager: mockTwitchManager,
    youtubeManager: mockYoutubeManager,
    quoteManager: mockQuoteManager,
    leagueManager: mockLeagueManager,
    patchManager: mockPatchManager,
    patchNotesManager: mockPatchManager, // Use the same mock for both
    userManager: mockUserManager,
    patchSubscriptionManager: mockPatchSubscriptionManager
};

// Export the getConfigManager function that returns the mock manager
export function getConfigManager() {
    return mockConfigManager;
}

// Helper function to set up mock data for specific test scenarios
export function setupMockData(testCase) {
    switch(testCase) {
        case 'birthdayEmpty':
            mockBirthdayManager.getAllPlain.mockResolvedValue([]);
            break;
        case 'birthdayToday':
            mockBirthdayManager.getAllPlain.mockResolvedValue(mockBirthdays);
            break;
        case 'twitchStreams':
            mockTwitchManager.getAllPlain.mockResolvedValue(mockTwitchStreams);
            break;
        case 'twitchEmpty':
            mockTwitchManager.getAllPlain.mockResolvedValue([]);
            break;
        case 'youtubeVideos':
            mockYoutubeManager.getAllPlain.mockResolvedValue(mockYoutubeChannels);
            break;
        case 'youtubeEmpty':
            mockYoutubeManager.getAllPlain.mockResolvedValue([]);
            break;
        case 'existingTwitchStream':
            mockTwitchManager.streamExists.mockResolvedValue(true);
            break;
        case 'leapYear':
            // Create birthdays specifically for Feb 29th
            mockBirthdayManager.getAllPlain.mockResolvedValue([leapYearBirthday]);
            break;
        default:
            break;
    }
}

// Reset all mock implementations
export function resetMockConfigManager() {
    // Reset all mocks to their default state
    Object.values(mockConfigManager).forEach(manager => {
        Object.values(manager).forEach(method => {
            if (method && typeof method.mockReset === 'function') {
                method.mockReset();
            }
        });
    });

    // Restore default implementations
    mockBirthdayManager.getAllPlain.mockResolvedValue([]);
    mockReminderManager.getAllPlain.mockResolvedValue(mockReminders);
    mockTwitchManager.getAllPlain.mockResolvedValue([]);
    mockYoutubeManager.getAllPlain.mockResolvedValue([]);
    mockTwitchManager.streamExists.mockResolvedValue(false);
}
