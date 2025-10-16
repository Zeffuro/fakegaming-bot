import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { CacheConfig } from '../../models/cache-config.js';

function uniq(base: string): string {
    return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function future(ms: number = 60_000): Date {
    return new Date(Date.now() + ms);
}

describe('CacheManager', () => {
    const cacheManager = configManager.cacheManager;

    beforeEach(async () => {
        await cacheManager.removeAll();
    });

    describe('basic operations', () => {
        it('should add a cache entry', async () => {
            const key = uniq('test-key');
            const entry = await cacheManager.add({
                key,
                value: 'test-value',
                expires: future(),
            } as any);

            expect(entry.key).toBe(key);
            expect(entry.value).toBe('test-value');
        });

        it('should get a cache entry', async () => {
            const key = uniq('test-key');
            await CacheConfig.create({
                key,
                value: 'test-value',
                expires: future(),
            });

            const result = await cacheManager.getOne({ key });
            expect(result).not.toBeNull();
            expect(result?.value).toBe('test-value');
        });

        it('should update a cache entry', async () => {
            const key = uniq('test-key');
            await CacheConfig.create({
                key,
                value: 'old-value',
                expires: future(),
            });

            await cacheManager.update({ value: 'new-value' } as any, { key });

            const result = await cacheManager.getOne({ key });
            expect(result?.value).toBe('new-value');
        });

        it('should remove a cache entry', async () => {
            const key = uniq('test-key');
            await CacheConfig.create({
                key,
                value: 'test-value',
                expires: future(),
            });

            await cacheManager.remove({ key });

            const result = await cacheManager.getOne({ key });
            expect(result).toBeNull();
        });

        it('should upsert cache entries', async () => {
            const key = uniq('upsert-key');
            await cacheManager.upsert({
                key,
                value: 'initial-value',
                expires: future(),
            } as any);

            let result = await cacheManager.getOne({ key });
            expect(result?.value).toBe('initial-value');

            await cacheManager.upsert({
                key,
                value: 'updated-value',
                expires: future(120_000),
            } as any);

            result = await cacheManager.getOne({ key });
            expect(result?.value).toBe('updated-value');
        });
    });
});
