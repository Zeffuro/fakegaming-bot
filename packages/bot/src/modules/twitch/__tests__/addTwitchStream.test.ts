import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

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

    it('adds a Twitch stream for notifications successfully', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Mock verifyTwitchUser to return true (Twitch user exists)
        const { verifyTwitchUser } = await import('../../../services/twitchService.js');
        vi.mocked(verifyTwitchUser).mockResolvedValue(true);

        // Mock for twitchManager's streamExists and add methods
        const streamExistsSpy = vi.fn().mockResolvedValue(false);
        const addSpy = vi.fn().mockResolvedValue({
            twitchUsername: 'testChannel',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined
        });

        // Mock channel and options
        const mockChannel = {
            id: '123456789012345678',
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/twitch/commands/addTwitchStream.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'username') return 'testChannel';
                            if (name === 'message') return null;
                            return null;
                        }),
                        getChannel: vi.fn().mockReturnValue(mockChannel)
                    },
                    guildId: '987654321098765432'
                },
                managerOverrides: {
                    twitchManager: {
                        streamExists: streamExistsSpy,
                        add: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalled();

        // Verify streamExists was called with correct parameters
        expect(streamExistsSpy).toHaveBeenCalledWith(
            'testChannel',
            '123456789012345678',
            '987654321098765432'
        );

        // Verify verifyTwitchUser was called with correct username
        expect(verifyTwitchUser).toHaveBeenCalledWith('testChannel');

        // Verify add method was called with correct parameters
        expect(addSpy).toHaveBeenCalledWith({
            twitchUsername: 'testChannel',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined
        });

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith(
            'Twitch stream `testChannel` added for notifications in <#123456789012345678>.'
        );
    });

    it('handles streams that already exist', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Mock for twitchManager's streamExists method to return true (stream already exists)
        const streamExistsSpy = vi.fn().mockResolvedValue(true);
        const addSpy = vi.fn();

        // Mock channel and options
        const mockChannel = {
            id: '123456789012345678',
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/twitch/commands/addTwitchStream.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'username') return 'testChannel';
                            return null;
                        }),
                        getChannel: vi.fn().mockReturnValue(mockChannel)
                    },
                    guildId: '987654321098765432'
                },
                managerOverrides: {
                    twitchManager: {
                        streamExists: streamExistsSpy,
                        add: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalled();

        // Verify streamExists was called with correct parameters
        expect(streamExistsSpy).toHaveBeenCalledWith(
            'testChannel',
            '123456789012345678',
            '987654321098765432'
        );

        // Verify add method was NOT called
        expect(addSpy).not.toHaveBeenCalled();

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Twitch stream `testChannel` is already configured for notifications in this channel.',
            flags: MessageFlags.Ephemeral
        });
    });

    it('handles nonexistent Twitch users', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Mock verifyTwitchUser to return false (Twitch user doesn't exist)
        const { verifyTwitchUser } = await import('../../../services/twitchService.js');
        vi.mocked(verifyTwitchUser).mockResolvedValue(false);

        // Mock for twitchManager's streamExists and add methods
        const streamExistsSpy = vi.fn().mockResolvedValue(false);
        const addSpy = vi.fn();

        // Mock channel and options
        const mockChannel = {
            id: '123456789012345678',
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/twitch/commands/addTwitchStream.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'username') return 'nonexistentChannel';
                            return null;
                        }),
                        getChannel: vi.fn().mockReturnValue(mockChannel)
                    },
                    guildId: '987654321098765432'
                },
                managerOverrides: {
                    twitchManager: {
                        streamExists: streamExistsSpy,
                        add: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalled();

        // Verify streamExists was called with correct parameters
        expect(streamExistsSpy).toHaveBeenCalledWith(
            'nonexistentChannel',
            '123456789012345678',
            '987654321098765432'
        );

        // Verify verifyTwitchUser was called with correct username
        expect(verifyTwitchUser).toHaveBeenCalledWith('nonexistentChannel');

        // Verify add method was NOT called
        expect(addSpy).not.toHaveBeenCalled();

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Twitch user `nonexistentChannel` does not exist.',
            flags: MessageFlags.Ephemeral
        });
    });

    it('handles users without admin permissions', async () => {
        // Mock requireAdmin to return false (user lacks admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(false);

        // Setup the test environment with minimal mocks since we'll return early
        const { command, interaction } = await setupCommandTest(
            'modules/twitch/commands/addTwitchStream.js',
            {
                interaction: {
                    guildId: '987654321098765432'
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalled();

        // Don't check interaction.options.getString as it may not exist in the type
    });
});
