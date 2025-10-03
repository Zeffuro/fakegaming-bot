import { vi } from 'vitest';

/**
 * Type for manager method mock implementations
 */
type ManagerMethodMocks = {
    [key: string]: ReturnType<typeof vi.fn>;
};

let activeMockConfigManager: any;

/**
 * Creates a mock manager based on the BaseManager class
 *
 * @param methods Object containing mock implementations for manager methods
 * @returns Mock manager with specified methods
 */
export function createMockBaseManager<T = any>(methods: ManagerMethodMocks = {}): any {
    // Base methods that are common to all managers
    const baseMethods = {
        getAllPlain: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue(null),
        add: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'mock-id-123' })),
        update: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(true),
        findOne: vi.fn().mockResolvedValue(null),
        findAll: vi.fn().mockResolvedValue([]),
    };

    // Combine base methods with provided custom methods
    return {
        ...baseMethods,
        ...methods,
    };
}

/**
 * Creates a mock birthday manager
 */
export function createMockBirthdayManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        getBirthday: vi.fn().mockResolvedValue(null),
        hasBirthday: vi.fn().mockResolvedValue(false),
        removeBirthday: vi.fn().mockResolvedValue(true),
        ...methods,
    });
}

/**
 * Creates a mock reminder manager
 */
export function createMockReminderManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        removeReminder: vi.fn().mockResolvedValue(true),
        setTimezone: vi.fn().mockResolvedValue(true),
        ...methods,
    });
}

/**
 * Creates a mock twitch manager
 */
export function createMockTwitchManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        streamExists: vi.fn().mockResolvedValue(false),
        getAll: vi.fn().mockReturnValue([]),
        ...methods,
    });
}

/**
 * Creates a mock youtube manager
 */
export function createMockYoutubeManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        getVideoChannel: vi.fn().mockResolvedValue(null),
        setVideoChannel: vi.fn().mockResolvedValue(true),
        ...methods,
    });
}

/**
 * Creates a mock quote manager
 */
export function createMockQuoteManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        getQuote: vi.fn().mockResolvedValue(null),
        getQuotesByAuthor: vi.fn().mockReturnValue([]),
        getQuotesByGuild: vi.fn().mockReturnValue([]),
        searchQuotes: vi.fn().mockReturnValue([]),
        ...methods,
    });
}

/**
 * Creates a mock patch notes manager
 */
export function createMockPatchManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        getLatestPatch: vi.fn().mockReturnValue({
            game: 'Test Game',
            title: 'Test Patch',
            content: 'Test Content',
            url: 'https://example.com/patch',
            date: new Date()
        }),
        ...methods,
    });
}

/**
 * Creates a mock patch subscription manager
 */
export function createMockPatchSubscriptionManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        subscribe: vi.fn().mockResolvedValue({ id: 'sub123' }),
        unsubscribe: vi.fn().mockResolvedValue(true),
        ...methods,
    });
}

/**
 * Creates a mock user manager
 */
export function createMockUserManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        getUserWithLeague: vi.fn().mockResolvedValue(null),
        setTimezone: vi.fn().mockResolvedValue(true),
        ...methods,
    });
}

/**
 * Creates a mock league manager
 */
export function createMockLeagueManager(methods: ManagerMethodMocks = {}) {
    return createMockBaseManager({
        ...methods,
    });
}

/**
 * Creates a mock config manager with all managers initialized
 */
export function createMockConfigManager(managerOverrides: Record<string, ManagerMethodMocks> = {}) {
    const manager = {
        birthdayManager: createMockBirthdayManager(managerOverrides.birthdayManager),
        reminderManager: createMockReminderManager(managerOverrides.reminderManager),
        twitchManager: createMockTwitchManager(managerOverrides.twitchManager),
        youtubeManager: createMockYoutubeManager(managerOverrides.youtubeManager),
        quoteManager: createMockQuoteManager(managerOverrides.quoteManager),
        leagueManager: createMockLeagueManager(managerOverrides.leagueManager),
        patchManager: createMockPatchManager(managerOverrides.patchManager),
        patchNotesManager: createMockPatchManager(managerOverrides.patchNotesManager),
        userManager: createMockUserManager(managerOverrides.userManager),
        patchSubscriptionManager: createMockPatchSubscriptionManager(managerOverrides.patchSubscriptionManager)
    };

    activeMockConfigManager = manager;
    return manager;
}

/**
 * Setup mocks for the entire fakegaming-common package
 */
export function setupManagerMocks(configManagerOverrides: Record<string, ManagerMethodMocks> = {}): void {
    const mockConfigManager = createMockConfigManager(configManagerOverrides);

    vi.mock('@zeffuro/fakegaming-common/managers', () => {
        return {
            configManager: mockConfigManager,
            getConfigManager: vi.fn(() => mockConfigManager),
        };
    });
}

export function getActiveMockConfigManager() {
    return activeMockConfigManager;
}
