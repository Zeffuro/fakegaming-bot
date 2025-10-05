import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { TwitchStreamConfig } from '../twitch-stream-config.js';

describe('TwitchStreamConfig Model', () => {
  beforeEach(async () => {
    await configManager.twitchManager.remove({});
  });

  it('should create a twitch stream config with required fields', async () => {
    const config = await TwitchStreamConfig.create({
      twitchUsername: 'streamer123',
      discordChannelId: 'channel-456',
      guildId: 'guild-789',
    });

    expect(config.twitchUsername).toBe('streamer123');
    expect(config.discordChannelId).toBe('channel-456');
    expect(config.guildId).toBe('guild-789');
    expect(config.customMessage).toBeUndefined();
  });

  it('should create a twitch stream config with custom message', async () => {
    const config = await TwitchStreamConfig.create({
      twitchUsername: 'streamer456',
      discordChannelId: 'channel-789',
      guildId: 'guild-101',
      customMessage: '{username} is now live!',
    });

    expect(config.customMessage).toBe('{username} is now live!');
  });

  it('should find configs by guildId', async () => {
    await TwitchStreamConfig.create({
      twitchUsername: 'streamer1',
      discordChannelId: 'channel-1',
      guildId: 'test-guild',
    });

    await TwitchStreamConfig.create({
      twitchUsername: 'streamer2',
      discordChannelId: 'channel-2',
      guildId: 'test-guild',
    });

    const configs = await TwitchStreamConfig.findAll({
      where: { guildId: 'test-guild' },
    });

    expect(configs).toHaveLength(2);
    expect(configs.every(c => c.guildId === 'test-guild')).toBe(true);
  });

  it('should update custom message', async () => {
    const config = await TwitchStreamConfig.create({
      twitchUsername: 'streamer-update',
      discordChannelId: 'channel-update',
      guildId: 'guild-update',
      customMessage: 'Old message',
    });

    config.customMessage = 'Updated message';
    await config.save();

    const updated = await TwitchStreamConfig.findByPk(config.id);
    expect(updated?.customMessage).toBe('Updated message');
  });

  it('should delete a twitch stream config', async () => {
    const config = await TwitchStreamConfig.create({
      twitchUsername: 'streamer-delete',
      discordChannelId: 'channel-delete',
      guildId: 'guild-delete',
    });

    const id = config.id;
    await config.destroy();

    const deleted = await TwitchStreamConfig.findByPk(id);
    expect(deleted).toBeNull();
  });

  it('should find config by twitch username', async () => {
    await TwitchStreamConfig.create({
      twitchUsername: 'specific-streamer',
      discordChannelId: 'channel-specific',
      guildId: 'guild-specific',
    });

    const config = await TwitchStreamConfig.findOne({
      where: { twitchUsername: 'specific-streamer' },
    });

    expect(config).not.toBeNull();
    expect(config?.twitchUsername).toBe('specific-streamer');
  });
});

