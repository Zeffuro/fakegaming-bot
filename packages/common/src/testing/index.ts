// Export all discord mocks
export {
  createMockUser,
  createMockChannel,
  createMockTextChannel,
  createMockGuild,
  createMockGuildMember,
  createMockMessage,
  createMockClient,
  createMockCommandInteraction,
  createMockButtonInteraction,
  createMockModalSubmitInteraction,
  createMockSend,
  setupDiscordMocks,
  withDiscordMocks
} from './mocks/discordMock.js';

// Export cache mocks
export {
  mockCacheGet,
  mockCacheSet,
  mockCacheDelete,
  setupCacheMocks,
  resetCacheMocks,
  withCacheMocks
} from './mocks/cacheMock.js';

// Export manager mocks
export {
  createMockBaseManager,
  createMockBirthdayManager,
  createMockReminderManager,
  createMockTwitchManager,
  createMockYoutubeManager,
  createMockQuoteManager,
  createMockPatchManager,
  createMockPatchSubscriptionManager,
  createMockUserManager,
  createMockLeagueManager,
  createMockConfigManager,
  setupManagerMocks,
  getActiveMockConfigManager
} from './mocks/managerMock.js';

// Export model mocks
export {
  createMockBirthday,
  createMockReminder,
  createMockTwitchStream,
  createMockYoutubeChannel,
  createMockQuote,
  createMockLeague,
  createMockUserWithLeague,
  createMockPatchNote,
  createMockPatchSubscription,
  createMockDisabledCommand,
  setupModelMocks
} from './mocks/modelMock.js';

// Export test utilities
export {
  setupTest,
  resetMocks,
  setupCommandTest,
  withAllMocks,
  type TestSetupOptions
} from './utils/testUtils.js';
