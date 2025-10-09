import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { PatchSubscriptionConfig } from '../patch-subscription-config.js';

describe('PatchSubscriptionConfig Model', () => {
  beforeEach(async () => {
    await configManager.patchSubscriptionManager.removeAll();
  });

  it('should create a patch subscription with required fields', async () => {
    const subscription = await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-123',
      guildId: 'guild-456',
    });

    expect(subscription.game).toBe('league');
    expect(subscription.channelId).toBe('channel-123');
    expect(subscription.guildId).toBe('guild-456');
    expect(subscription.lastAnnouncedAt).toBeUndefined();
  });

  it('should create a patch subscription with lastAnnouncedAt', async () => {
    const now = Date.now();
    const subscription = await PatchSubscriptionConfig.create({
      game: 'valorant',
      channelId: 'channel-789',
      guildId: 'guild-101',
      lastAnnouncedAt: now,
    });

    expect(subscription.lastAnnouncedAt).toBe(now);
  });

  it('should enforce unique game-channel combination', async () => {
    await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-unique',
      guildId: 'guild-1',
    });

    await expect(
      PatchSubscriptionConfig.create({
        game: 'league',
        channelId: 'channel-unique',
        guildId: 'guild-2',
      })
    ).rejects.toThrow();
  });

  it('should allow same game in different channels', async () => {
    await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-1',
      guildId: 'guild-test',
    });

    const subscription = await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-2',
      guildId: 'guild-test',
    });

    expect(subscription).not.toBeNull();
  });

  it('should allow different games in same channel', async () => {
    await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-multi',
      guildId: 'guild-test',
    });

    const subscription = await PatchSubscriptionConfig.create({
      game: 'valorant',
      channelId: 'channel-multi',
      guildId: 'guild-test',
    });

    expect(subscription).not.toBeNull();
  });

  it('should find subscriptions by guildId', async () => {
    await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-1',
      guildId: 'test-guild',
    });

    await PatchSubscriptionConfig.create({
      game: 'valorant',
      channelId: 'channel-2',
      guildId: 'test-guild',
    });

    const subscriptions = await PatchSubscriptionConfig.findAll({
      where: { guildId: 'test-guild' },
    });

    expect(subscriptions).toHaveLength(2);
  });

  it('should update lastAnnouncedAt', async () => {
    const subscription = await PatchSubscriptionConfig.create({
      game: 'tft',
      channelId: 'channel-update',
      guildId: 'guild-update',
    });

    const newTimestamp = Date.now();
    subscription.lastAnnouncedAt = newTimestamp;
    await subscription.save();

    const updated = await PatchSubscriptionConfig.findByPk(subscription.id);
    expect(updated?.lastAnnouncedAt).toBe(newTimestamp);
  });

  it('should delete a subscription', async () => {
    const subscription = await PatchSubscriptionConfig.create({
      game: 'league',
      channelId: 'channel-delete',
      guildId: 'guild-delete',
    });

    const id = subscription.id;
    await subscription.destroy();

    const deleted = await PatchSubscriptionConfig.findByPk(id);
    expect(deleted).toBeNull();
  });
});

