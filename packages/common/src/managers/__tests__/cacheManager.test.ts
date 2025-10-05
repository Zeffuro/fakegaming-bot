import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { CacheConfig } from '../../models/cache-config.js';

describe('CacheManager', () => {
    const cacheManager = configManager.cacheManager;

    beforeEach(async () => {
        await cacheManager.remove({});
    });

    describe('basic operations', () => {
        it('should add a cache entry', async () => {
            const entry = await cacheManager.add({
                key: 'test-key',
                value: 'test-value',
            });

            expect(entry.key).toBe('test-key');
            expect(entry.value).toBe('test-value');
        });

        it('should get a cache entry', async () => {
            await CacheConfig.create({
                key: 'test-key',
                value: 'test-value',
            });

            const result = await cacheManager.getOne({ key: 'test-key' });
            expect(result).not.toBeNull();
            expect(result?.value).toBe('test-value');
        });

        it('should update a cache entry', async () => {
            await CacheConfig.create({
                key: 'test-key',
                value: 'old-value',
            });

            await cacheManager.update({ value: 'new-value' }, { key: 'test-key' });

            const result = await cacheManager.getOne({ key: 'test-key' });
            expect(result?.value).toBe('new-value');
        });

        it('should remove a cache entry', async () => {
            await CacheConfig.create({
                key: 'test-key',
                value: 'test-value',
            });

            await cacheManager.remove({ key: 'test-key' });

            const result = await cacheManager.getOne({ key: 'test-key' });
            expect(result).toBeNull();
        });

        it('should upsert cache entries', async () => {
            await cacheManager.upsert({
                key: 'upsert-key',
                value: 'initial-value',
            });

            let result = await cacheManager.getOne({ key: 'upsert-key' });
            expect(result?.value).toBe('initial-value');

            await cacheManager.upsert({
                key: 'upsert-key',
                value: 'updated-value',
            });

            result = await cacheManager.getOne({ key: 'upsert-key' });
            expect(result?.value).toBe('updated-value');
        });
    });
});

