import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { YoutubeVideoConfig } from '../youtube-video-config.js';

describe('YoutubeVideoConfig Model', () => {
  beforeEach(async () => {
    await configManager.youtubeManager.removeAll();
  });

  it('should create a youtube config with required fields', async () => {
    const config = await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC123456',
      discordChannelId: 'discord-channel-789',
      guildId: 'guild-101',
    });

    expect(config.youtubeChannelId).toBe('UC123456');
    expect(config.discordChannelId).toBe('discord-channel-789');
    expect(config.guildId).toBe('guild-101');
    expect(config.lastVideoId).toBeUndefined();
    expect(config.customMessage).toBeUndefined();
  });

  it('should create a youtube config with optional fields', async () => {
    const config = await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC789012',
      discordChannelId: 'discord-channel-456',
      guildId: 'guild-202',
      lastVideoId: 'video-123',
      customMessage: 'New video from {channel}!',
    });

    expect(config.lastVideoId).toBe('video-123');
    expect(config.customMessage).toBe('New video from {channel}!');
  });

  it('should update lastVideoId', async () => {
    const config = await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC-update',
      discordChannelId: 'channel-update',
      guildId: 'guild-update',
      lastVideoId: 'video-old',
    });

    config.lastVideoId = 'video-new';
    await config.save();

    const updated = await YoutubeVideoConfig.findByPk(config.id);
    expect(updated?.lastVideoId).toBe('video-new');
  });

  it('should find configs by guildId', async () => {
    await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC-1',
      discordChannelId: 'channel-1',
      guildId: 'test-guild',
    });

    await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC-2',
      discordChannelId: 'channel-2',
      guildId: 'test-guild',
    });

    const configs = await YoutubeVideoConfig.findAll({
      where: { guildId: 'test-guild' },
    });

    expect(configs).toHaveLength(2);
    expect(configs.every(c => c.guildId === 'test-guild')).toBe(true);
  });

  it('should delete a youtube config', async () => {
    const config = await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC-delete',
      discordChannelId: 'channel-delete',
      guildId: 'guild-delete',
    });

    const id = config.id;
    await config.destroy();

    const deleted = await YoutubeVideoConfig.findByPk(id);
    expect(deleted).toBeNull();
  });

  it('should find config by youtube channel id', async () => {
    await YoutubeVideoConfig.create({
      youtubeChannelId: 'UC-specific',
      discordChannelId: 'channel-specific',
      guildId: 'guild-specific',
    });

    const config = await YoutubeVideoConfig.findOne({
      where: { youtubeChannelId: 'UC-specific' },
    });

    expect(config).not.toBeNull();
    expect(config?.youtubeChannelId).toBe('UC-specific');
  });
});

