/**
 * Shared authentication setup for tests
 * This sets up the cache data that authHelpers expects
 * Uses an in-memory cache to avoid hitting real Redis
 */
import { CACHE_KEYS, CACHE_TTL, MinimalGuildData, CacheManager } from '@zeffuro/fakegaming-common';

/**
 * In-memory cache manager for tests
 * This avoids using real Redis which would cost money
 */
class InMemoryCacheManager implements CacheManager {
    private cache = new Map<string, { value: any; expiry: number }>();

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        if (!item) return null;

        // Check if expired
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
        await this.del(CACHE_KEYS.userProfile(userId));
        await this.del(CACHE_KEYS.userGuilds(userId));
        await this.del(CACHE_KEYS.userAccessToken(userId));
    }

    clear(): void {
        this.cache.clear();
    }
}

/**
 * Singleton in-memory cache manager for tests
 */
export const testCacheManager = new InMemoryCacheManager();

/**
 * Mock guild data for tests - these guilds will be available to the test user
 */
export const TEST_GUILDS: MinimalGuildData[] = [
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
    }
];

/**
 * Set up cache data for a test user
 * This should be called in beforeAll or beforeEach for tests that use requireGuildAdmin
 */
export async function setupTestUserCache(discordId: string = 'testuser', guilds: MinimalGuildData[] = TEST_GUILDS): Promise<void> {
    await testCacheManager.set(
        CACHE_KEYS.userGuilds(discordId),
        guilds,
        CACHE_TTL.USER_GUILDS
    );
}

/**
 * Clear cache data for a test user
 */
export async function clearTestUserCache(discordId: string = 'testuser'): Promise<void> {
    await testCacheManager.del(CACHE_KEYS.userGuilds(discordId));
}
