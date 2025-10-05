/**
 * Tests for utils/cacheManager.ts cache management utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCacheManager, CACHE_KEYS, CACHE_TTL } from '../cacheManager.js';

vi.mock('../../cache.js', () => ({
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
    cacheDel: vi.fn(),
    ensureRedis: vi.fn()
}));

const { cacheGet, cacheSet, cacheDel } = await import('../../cache.js');

describe('CacheManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('get', () => {
        it('should retrieve data from cache', async () => {
            const manager = getCacheManager();
            (cacheGet as any).mockResolvedValue({ data: 'test' });
            const result = await manager.get('test-key');
            expect(result).toEqual({ data: 'test' });
            expect(cacheGet).toHaveBeenCalledWith('test-key');
        });
    });

    describe('set', () => {
        it('should store data in cache', async () => {
            const manager = getCacheManager();
            await manager.set('test-key', { data: 'test' }, 1000);
            expect(cacheSet).toHaveBeenCalledWith('test-key', { data: 'test' }, 1000);
        });
    });

    describe('del', () => {
        it('should delete data from cache', async () => {
            const manager = getCacheManager();
            await manager.del('test-key');
            expect(cacheDel).toHaveBeenCalledWith('test-key');
        });
    });

    describe('getCachedData', () => {
        it('should return cached data if present', async () => {
            const manager = getCacheManager();
            (cacheGet as any).mockResolvedValue({ data: 'cached' });
            const fetchFn = vi.fn();
            const result = await manager.getCachedData('test-key', fetchFn, 1000);
            expect(result).toEqual({ data: 'cached' });
            expect(fetchFn).not.toHaveBeenCalled();
        });

        it('should fetch and cache data if not present', async () => {
            const manager = getCacheManager();
            (cacheGet as any).mockResolvedValue(null);
            const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });
            const result = await manager.getCachedData('test-key', fetchFn, 1000);
            expect(result).toEqual({ data: 'fresh' });
            expect(fetchFn).toHaveBeenCalled();
            expect(cacheSet).toHaveBeenCalledWith('test-key', { data: 'fresh' }, 1000);
        });

        it('should return null on error', async () => {
            const manager = getCacheManager();
            (cacheGet as any).mockRejectedValue(new Error('cache error'));
            const result = await manager.getCachedData('test-key', vi.fn(), 1000);
            expect(result).toBeNull();
        });
    });

    describe('clearUserCache', () => {
        it('should delete all user-related cache keys', async () => {
            const manager = getCacheManager();
            await manager.clearUserCache('user123');
            expect(cacheDel).toHaveBeenCalledWith(CACHE_KEYS.userProfile('user123'));
            expect(cacheDel).toHaveBeenCalledWith(CACHE_KEYS.userGuilds('user123'));
            expect(cacheDel).toHaveBeenCalledWith(CACHE_KEYS.userAccessToken('user123'));
        });
    });

    describe('CACHE_KEYS', () => {
        it('should generate correct cache keys', () => {
            expect(CACHE_KEYS.userProfile('123')).toBe('user:123:profile');
            expect(CACHE_KEYS.userGuilds('123')).toBe('user:123:guilds');
            expect(CACHE_KEYS.userAccessToken('123')).toBe('user:123:access_token');
            expect(CACHE_KEYS.guildChannels('456')).toBe('guild:456:channels');
            expect(CACHE_KEYS.botGuilds()).toBe('bot_guilds');
        });
    });

    describe('CACHE_TTL', () => {
        it('should have correct TTL values', () => {
            expect(CACHE_TTL.USER_PROFILE).toBe(24 * 60 * 60 * 1000);
            expect(CACHE_TTL.USER_GUILDS).toBe(60 * 60 * 1000);
            expect(CACHE_TTL.GUILD_CHANNELS).toBe(30 * 60 * 1000);
            expect(CACHE_TTL.ACCESS_TOKEN).toBe(3600 * 1000);
            expect(CACHE_TTL.BOT_GUILDS).toBe(15 * 60 * 1000);
        });
    });
});

