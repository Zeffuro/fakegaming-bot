import { beforeEach, describe, expect, it } from 'vitest';
import { VoiceChannelOccupancyConfig } from '../../models/voice-channel-occupancy-config.js';
import { configManager } from '../../vitest.setup.js';

describe('VoiceChannelOccupancyConfigManager', () => {
    const manager = configManager.voiceChannelOccupancyConfigManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('stores one occupied voice channel per guild and updates it', async () => {
        await expect(manager.setForGuild('guild-1', 'voice-1')).resolves.toEqual({
            guildId: 'guild-1',
            channelId: 'voice-1',
        });
        await expect(manager.setForGuild('guild-1', 'voice-2')).resolves.toEqual({
            guildId: 'guild-1',
            channelId: 'voice-2',
        });
        await expect(manager.getForGuild('guild-1')).resolves.toEqual({
            guildId: 'guild-1',
            channelId: 'voice-2',
        });
        await expect(VoiceChannelOccupancyConfig.count()).resolves.toBe(1);
    });

    it('lists guild configurations and disables them independently', async () => {
        await manager.setForGuild('guild-1', 'voice-1');
        await manager.setForGuild('guild-2', 'voice-2');

        await expect(manager.listConfiguredGuilds()).resolves.toEqual(expect.arrayContaining([
            { guildId: 'guild-1', channelId: 'voice-1' },
            { guildId: 'guild-2', channelId: 'voice-2' },
        ]));
        await expect(manager.disableForGuild('guild-1')).resolves.toBe(true);
        await expect(manager.disableForGuild('guild-1')).resolves.toBe(false);
        await expect(manager.getForGuild('guild-2')).resolves.toEqual({
            guildId: 'guild-2',
            channelId: 'voice-2',
        });
    });

    it('rejects empty identifiers before writing', async () => {
        await expect(manager.setForGuild('', 'voice-1')).rejects.toThrow('Guild ID is required');
        await expect(manager.setForGuild('guild-1', ' ')).rejects.toThrow('Channel ID is required');
        await expect(VoiceChannelOccupancyConfig.count()).resolves.toBe(0);
    });
});
