import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { UserConfig } from '../user-config.js';

describe('UserConfig Model', () => {
  beforeEach(async () => {
    // Clean up before each test
    await configManager.userManager.removeAll();
  });

  it('should create a user with required fields', async () => {
    const user = await UserConfig.create({
      discordId: '123456789',
    });

    expect(user.discordId).toBe('123456789');
    expect(user.nickname).toBeUndefined();
    expect(user.timezone).toBeUndefined();
  });

  it('should create a user with optional fields', async () => {
    const user = await UserConfig.create({
      discordId: '987654321',
      nickname: 'TestUser',
      timezone: 'America/New_York',
      defaultReminderTimeSpan: '1h',
    });

    expect(user.discordId).toBe('987654321');
    expect(user.nickname).toBe('TestUser');
    expect(user.timezone).toBe('America/New_York');
    expect(user.defaultReminderTimeSpan).toBe('1h');
  });

  it('should update user fields', async () => {
    const user = await UserConfig.create({
      discordId: '111222333',
    });

    user.nickname = 'UpdatedNickname';
    user.timezone = 'Europe/London';
    await user.save();

    const updated = await UserConfig.findByPk('111222333');
    expect(updated?.nickname).toBe('UpdatedNickname');
    expect(updated?.timezone).toBe('Europe/London');
  });

  it('should delete a user', async () => {
    const user = await UserConfig.create({
      discordId: '444555666',
    });

    await user.destroy();

    const deleted = await UserConfig.findByPk('444555666');
    expect(deleted).toBeNull();
  });

  it('should enforce unique discordId', async () => {
    await UserConfig.create({
      discordId: 'unique123',
    });

    await expect(
      UserConfig.create({
        discordId: 'unique123',
      })
    ).rejects.toThrow();
  });
});
