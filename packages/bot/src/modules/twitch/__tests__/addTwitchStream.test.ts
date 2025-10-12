import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { makeAddTwitchTestHelpers } from './helpers/addTwitchTestHelpers.js';

// Mock the twitchService module
vi.mock('../../../services/twitchService.js', () => ({
    verifyTwitchUser: vi.fn()
}));

// Mock the permissions utility
vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

describe('addTwitchStream command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    const H = makeAddTwitchTestHelpers();

    it('adds a Twitch stream for notifications successfully', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await H.mockAdmin(true);

        // Mock verifyTwitchUser to return true (Twitch user exists)
        const { verifyTwitchUser } = await H.mockVerifyUser(true);

        // Mock for twitchManager's streamExists and add methods
        const streamExistsSpy = vi.fn().mockResolvedValue(false);
        const addSpy = vi.fn().mockResolvedValue({
            twitchUsername: 'testChannel',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined
        });

        // Setup the test environment
        const { command, interaction } = await H.setupCmd({
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                twitchManager: {
                    streamExists: streamExistsSpy,
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
            verifyTwitchUser,
            streamExistsSpy,
            addSpy,
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432'
        });
    });

    it('handles streams that already exist', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await H.mockAdmin(true);

        // Mock for twitchManager's streamExists method to return true (stream already exists)
        const streamExistsSpy = vi.fn().mockResolvedValue(true);
        const addSpy = vi.fn();

        // Setup the test environment
        const { command, interaction } = await H.setupCmd({
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                twitchManager: {
                    streamExists: streamExistsSpy,
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
            streamExistsSpy,
            addSpy,
            username: 'testChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432'
        });
    });

    it('handles nonexistent Twitch users', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await H.mockAdmin(true);

        // Mock verifyTwitchUser to return false (Twitch user doesn't exist)
        const { verifyTwitchUser } = await H.mockVerifyUser(false);

        // Mock for twitchManager's streamExists and add methods
        const streamExistsSpy = vi.fn().mockResolvedValue(false);
        const addSpy = vi.fn();

        // Setup the test environment
        const { command, interaction } = await H.setupCmd({
            username: 'nonexistentChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                twitchManager: {
                    streamExists: streamExistsSpy,
                    add: addSpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Assertions
        H.assertNonexistent({
            interaction,
            requireAdmin,
            verifyTwitchUser,
            streamExistsSpy,
            addSpy,
            username: 'nonexistentChannel',
            channelId: '123456789012345678',
            guildId: '987654321098765432'
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

        // Verify requireAdmin was called and no reply was sent
        expect(requireAdmin).toHaveBeenCalled();
        H.assertNoInteractionReply(interaction);
    });
});
