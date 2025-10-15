import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Set up test environment variables
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming-test';

// Mock the defaultCacheManager to use our shared in-memory test cache
// This prevents tests from connecting to real Redis
// IMPORTANT: Everything must be self-contained inside the factory due to hoisting
vi.mock('@zeffuro/fakegaming-common', async () => {
    const actual = await vi.importActual<typeof import('@zeffuro/fakegaming-common')>('@zeffuro/fakegaming-common');

    // Define the in-memory cache manager class inline
    class InMemoryCacheManager {
        private cache = new Map<string, { value: any; expiry: number }>();

        async get<T>(key: string): Promise<T | null> {
            const item = this.cache.get(key);
            if (!item) return null;

            if (Date.now() > item.expiry) {
                this.cache.delete(key);
                return null;
            }

            return item.value as T;
        }

        async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
            this.cache.set(key, {
                value,
                expiry: Date.now() + ttlMs
            });
        }

        async del(key: string): Promise<void> {
            this.cache.delete(key);
        }

        async getCachedData<T>(key: string, fetchFn: () => Promise<T>, ttlMs: number): Promise<T | null> {
            const cached = await this.get<T>(key);
            if (cached) return cached;

            const fresh = await fetchFn();
            if (fresh) {
                await this.set(key, fresh, ttlMs);
            }
            return fresh;
        }

        async clearUserCache(userId: string): Promise<void> {
            await this.del(actual.CACHE_KEYS.userProfile(userId));
            await this.del(actual.CACHE_KEYS.userGuilds(userId));
            await this.del(actual.CACHE_KEYS.userAccessToken(userId));
        }

        clear(): void {
            this.cache.clear();
        }
    }

    // Create instance and store it on global for access
    const mockCache = new InMemoryCacheManager();
    (global as any).__testCacheManager = mockCache;

    // Preserve all original exports INCLUDING PostgresRateLimiter
    return {
        ...actual,
        defaultCacheManager: mockCache,
        PostgresRateLimiter: actual.PostgresRateLimiter,
    };
});

// Now import from the mocked module
import { getConfigManager, getSequelize, CACHE_KEYS, CACHE_TTL, MinimalGuildData } from '@zeffuro/fakegaming-common';

/**
 * Mock guild data for tests - these guilds will be available to the test user
 */
const TEST_GUILDS: MinimalGuildData[] = [
    {
        id: 'testguild1',
        permissions: '8' // Administrator permission
    },
    {
        id: 'testguild2',
        permissions: '8'
    },
    {
        id: 'testguild3',
        permissions: '8'
    },
    {
        id: 'birthdayguild1',
        permissions: '8'
    },
    {
        id: 'birthdayguild2',
        permissions: '8'
    },
    {
        id: 'birthdayguild3',
        permissions: '8'
    },
    {
        id: 'jwtguild',
        permissions: '8'
    },
    {
        id: 'testserver1',
        permissions: '8'
    }
];

// Initialize config manager for tests
export const configManager = getConfigManager();

// Setup test database before all tests
beforeAll(async () => {
    // Ensure database is initialized
    await configManager.init(true);
}, 30000);

// Clean up after all tests
afterAll(async () => {
    // Close database connections
    const sequelize = getSequelize(true);
    if (sequelize) {
        await sequelize.close();
    }
});

// Reset state before each test
beforeEach(async () => {
    // Access the shared cache from global
    const testCache = (global as any).__testCacheManager;

    // Clear the shared cache before each test
    if (testCache && testCache.clear) {
        testCache.clear();
    }

    // Set up cache data for test user so authHelpers can validate permissions
    if (testCache) {
        await testCache.set(
            CACHE_KEYS.userGuilds('testuser'),
            TEST_GUILDS,
            CACHE_TTL.USER_GUILDS
        );
    }
});
