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

export {
  mockCacheGet,
  mockCacheSet,
  mockCacheDelete,
  setupCacheMocks,
  resetCacheMocks,
  withCacheMocks
} from './mocks/cacheMock.js';

export {
    createMockConfigManager,
    setupManagerMocks,
    getActiveMockConfigManager,
    createMockManager
} from './mocks/managerMock.js';

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

export {
    setupTest,
    resetMocks,
    setupCommandTest,
    setupServiceTest,
    withAllMocks
} from './utils/testUtils.js';

export {
    signTestJwt,
    verifyTestJwt
} from './utils/jwtTestUtils.js';

// API Testing utilities
export {
    setupApiTest,
    setupApiRouteTest,
    withApiTest,
    type ApiTestSetupOptions
} from './utils/apiTestUtils.js';

export {
    createMockRequest,
    createMockResponse,
    createMockNext,
    createMockAuthRequest
} from './mocks/expressMock.js';

export {
    createTestApp,
    createAuthenticatedTestApp,
    type AppFactory,
    type RouterFactory,
    type AppFactoryDependencies,
    type RouterFactoryDependencies
} from './factories/apiTestFactory.js';
