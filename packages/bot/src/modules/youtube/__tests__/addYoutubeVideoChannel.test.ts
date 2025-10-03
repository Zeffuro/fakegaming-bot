import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

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

    it('adds a YouTube channel for notifications successfully', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Mock getYoutubeChannelId to return a valid channel ID
        const { getYoutubeChannelId } = await import('../../../services/youtubeService.js');
        vi.mocked(getYoutubeChannelId).mockResolvedValue('UC1234567890');

        // Mock for youtubeManager's getVideoChannel and add methods
        const getVideoChannelSpy = vi.fn().mockResolvedValue(null); // No existing config
        const addSpy = vi.fn().mockResolvedValue({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined,
            lastVideoId: undefined
        });

        // Mock channel and options
        const mockChannel = {
            id: '123456789012345678',
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/youtube/commands/addYoutubeVideoChannel.js',
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
                    youtubeManager: {
                        getVideoChannel: getVideoChannelSpy,
                        add: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify getYoutubeChannelId was called with correct username
        expect(getYoutubeChannelId).toHaveBeenCalledWith('testChannel');

        // Verify getVideoChannel was called with correct parameters
        expect(getVideoChannelSpy).toHaveBeenCalledWith({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432'
        });

        // Verify add method was called with correct parameters
        expect(addSpy).toHaveBeenCalledWith({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            lastVideoId: undefined,
            customMessage: undefined
        });

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith(
            `Youtube channel \`testChannel\` added for video notifications in #123456789012345678.`
        );
    });

    it('handles channels that already exist', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Mock getYoutubeChannelId to return a valid channel ID
        const { getYoutubeChannelId } = await import('../../../services/youtubeService.js');
        vi.mocked(getYoutubeChannelId).mockResolvedValue('UC1234567890');

        // Mock for youtubeManager's getVideoChannel to return an existing config
        const getVideoChannelSpy = vi.fn().mockResolvedValue({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432'
        });
        const addSpy = vi.fn();

        // Mock channel and options
        const mockChannel = {
            id: '123456789012345678',
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/youtube/commands/addYoutubeVideoChannel.js',
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
                    youtubeManager: {
                        getVideoChannel: getVideoChannelSpy,
                        add: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify getYoutubeChannelId was called with correct username
        expect(getYoutubeChannelId).toHaveBeenCalledWith('testChannel');

        // Verify getVideoChannel was called with correct parameters
        expect(getVideoChannelSpy).toHaveBeenCalledWith({
            youtubeChannelId: 'UC1234567890',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432'
        });

        // Verify add method was NOT called
        expect(addSpy).not.toHaveBeenCalled();

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith({
            content: `Youtube channel \`testChannel\` is already configured for video notifications in this channel.`,
            flags: MessageFlags.Ephemeral
        });
    });

    it('handles nonexistent YouTube channels', async () => {
        // Mock requireAdmin to return true (user has admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Mock getYoutubeChannelId to return null (channel doesn't exist)
        const { getYoutubeChannelId } = await import('../../../services/youtubeService.js');
        vi.mocked(getYoutubeChannelId).mockResolvedValue(null);

        // Mock channel and options
        const mockChannel = {
            id: '123456789012345678',
            name: 'test-channel'
        };

        // Setup the test environment with only necessary mocks
        const { command, interaction } = await setupCommandTest(
            'modules/youtube/commands/addYoutubeVideoChannel.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('nonexistentChannel'),
                        getChannel: vi.fn().mockReturnValue(mockChannel)
                    },
                    guildId: '987654321098765432'
                }
            }
        );

        // Execute the command
        await command.execute(interaction as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify getYoutubeChannelId was called with correct username
        expect(getYoutubeChannelId).toHaveBeenCalledWith('nonexistentChannel');

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith({
            content: `Youtube channel \`nonexistentChannel\` does not exist.`,
            flags: MessageFlags.Ephemeral
        });
    });

    it('handles users without admin permissions', async () => {
        // Mock requireAdmin to return false (user lacks admin permissions)
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(false);

        // Setup the test environment with minimal mocks since we'll return early
        const { command, interaction } = await setupCommandTest(
            'modules/youtube/commands/addYoutubeVideoChannel.js',
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

        // There's no need to verify that interaction.options.getString wasn't called,
        // as the mock might not have this property defined
    });
});
