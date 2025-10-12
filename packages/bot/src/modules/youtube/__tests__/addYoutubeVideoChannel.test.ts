import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { makeAddYoutubeTestHelpers } from './helpers/addYoutubeTestHelpers.js';

// Mock the youtubeService module
vi.mock('../../../services/youtubeService.js', () => ({
    getYoutubeChannelId: vi.fn()
}));

// Mock the permissions utility
vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

describe('addYoutubeVideoChannel command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    const H = makeAddYoutubeTestHelpers();

    it('adds a YouTube channel for notifications successfully', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await H.mockAdmin(true);

        // Mock getYoutubeChannelId to return a valid channel ID
        const { getYoutubeChannelId } = await H.mockGetChannelId('UC1234567890');

        // Mock for youtubeManager's getVideoChannel and add methods
        const getVideoChannelSpy = vi.fn().mockResolvedValue(null); // No existing config
        const addSpy = vi.fn().mockResolvedValue({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined,
            lastVideoId: undefined
        });

        // Setup the test environment
        const { command, interaction } = await H.setupCmd({
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                youtubeManager: {
                    getVideoChannel: getVideoChannelSpy,
                    add: addSpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Assertions
        H.assertAdded({
            interaction,
            requireAdmin,
            getYoutubeChannelId,
            getVideoChannelSpy,
            addSpy,
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            youtubeChannelId: 'UC1234567890'
        });
    });

    it('handles channels that already exist', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await H.mockAdmin(true);

        // Mock getYoutubeChannelId to return a valid channel ID
        const { getYoutubeChannelId } = await H.mockGetChannelId('UC1234567890');

        // Mock for youtubeManager's getVideoChannel to return an existing config
        const getVideoChannelSpy = vi.fn().mockResolvedValue({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432'
        });
        const addSpy = vi.fn();

        // Setup the test environment
        const { command, interaction } = await H.setupCmd({
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                youtubeManager: {
                    getVideoChannel: getVideoChannelSpy,
                    add: addSpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Assertions
        H.assertAlreadyExists({
            interaction,
            requireAdmin,
            getYoutubeChannelId,
            getVideoChannelSpy,
            addSpy,
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            youtubeChannelId: 'UC1234567890'
        });
    });

    it('handles nonexistent YouTube channels', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await H.mockAdmin(true);

        // Mock getYoutubeChannelId to return null (channel doesn't exist)
        const { getYoutubeChannelId } = await H.mockGetChannelId(null);

        // Setup the test environment with only necessary mocks
        const { command, interaction } = await H.setupCmd({
            username: 'nonexistentChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432'
        });

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Assertions
        H.assertNonexistent({
            interaction,
            requireAdmin,
            getYoutubeChannelId,
            username: 'nonexistentChannel'
        });
    });

    it('handles users without admin permissions', async () => {
        // Mock requireAdmin to return false (user lacks admin permissions)
        const { requireAdmin } = await H.mockAdmin(false);

        // Setup the test environment with minimal mocks since we'll return early
        const { command, interaction } = await H.setupCmd({
            guildId: '987654321098765432'
        });

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalled();
    });
});
