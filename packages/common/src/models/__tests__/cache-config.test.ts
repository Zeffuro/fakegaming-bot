import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { CacheConfig } from '../cache-config.js';

describe('CacheConfig Model', () => {
  beforeEach(async () => {
    await configManager.cacheManager.remove({});
  });

  it('should create a cache entry with all fields', async () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

    const cache = await CacheConfig.create({
      key: 'test-key',
      value: JSON.stringify({ data: 'test data' }),
      expires: futureDate,
    });

    expect(cache.key).toBe('test-key');
    expect(cache.value).toBe(JSON.stringify({ data: 'test data' }));
    expect(cache.expires).toBeInstanceOf(Date);
  });

  it('should store and retrieve JSON data', async () => {
    const testData = {
      userId: '123',
      username: 'TestUser',
      timestamp: Date.now(),
    };

    await CacheConfig.create({
      key: 'json-test',
      value: JSON.stringify(testData),
      expires: new Date(Date.now() + 3600000),
    });

    const cached = await CacheConfig.findByPk('json-test');
    const parsedData = JSON.parse(cached!.value);

    expect(parsedData.userId).toBe('123');
    expect(parsedData.username).toBe('TestUser');
  });

  it('should find expired cache entries', async () => {
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

    await CacheConfig.create({
      key: 'expired-key',
      value: 'expired data',
      expires: pastDate,
    });

    await CacheConfig.create({
      key: 'valid-key',
      value: 'valid data',
      expires: futureDate,
    });

    const { Op } = await import('sequelize');
    const expired = await CacheConfig.findAll({
      where: {
        expires: {
          [Op.lt]: new Date(),
        },
      },
    });

    expect(expired.some(c => c.key === 'expired-key')).toBe(true);
    expect(expired.some(c => c.key === 'valid-key')).toBe(false);
  });

  it('should update cache value', async () => {
    const cache = await CacheConfig.create({
      key: 'update-key',
      value: 'original value',
      expires: new Date(Date.now() + 3600000),
    });

    cache.value = 'updated value';
    await cache.save();

    const updated = await CacheConfig.findByPk('update-key');
    expect(updated?.value).toBe('updated value');
  });

  it('should delete a cache entry', async () => {
    const cache = await CacheConfig.create({
      key: 'delete-key',
      value: 'delete me',
      expires: new Date(Date.now() + 3600000),
    });

    await cache.destroy();

    const deleted = await CacheConfig.findByPk('delete-key');
    expect(deleted).toBeNull();
  });

  it('should enforce unique key constraint', async () => {
    await CacheConfig.create({
      key: 'unique-key',
      value: 'first value',
      expires: new Date(Date.now() + 3600000),
    });

    await expect(
      CacheConfig.create({
        key: 'unique-key',
        value: 'second value',
        expires: new Date(Date.now() + 3600000),
      })
    ).rejects.toThrow();
  });

  it('should extend expiration time', async () => {
    const originalExpiry = new Date(Date.now() + 3600000);
    const cache = await CacheConfig.create({
      key: 'extend-key',
      value: 'test data',
      expires: originalExpiry,
    });

    const newExpiry = new Date(Date.now() + 7200000); // 2 hours
    cache.expires = newExpiry;
    await cache.save();

    const updated = await CacheConfig.findByPk('extend-key');
    expect(updated?.expires.getTime()).toBe(newExpiry.getTime());
  });
});
