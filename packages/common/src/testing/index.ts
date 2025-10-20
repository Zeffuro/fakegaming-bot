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
  withDiscordMocks,
  createMockAutocompleteInteraction
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

export * from './utils/assertions.js';

export { withFetchMock } from './mocks/fetchMock.js';

// Shared API test client helper
export {
    givenAuthenticatedClient,
    type AuthClient,
    type GivenAuthClientOptions
} from './utils/apiClient.js';

// Cache seeding helpers
export { seedUserGuilds, seedUserProfiles, seedUserGuildNick } from './utils/cacheSeed.js';

// Canvas mocks
export { createMockCanvasContext2D, type Canvas2DMock } from './mocks/canvasMock.js';

// Job queue test helper
export { TestJobQueue, getJobHandler, runJobHandler } from './mocks/jobQueueMock.js';
