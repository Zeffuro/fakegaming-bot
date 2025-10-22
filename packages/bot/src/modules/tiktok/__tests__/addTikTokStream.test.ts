import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { makeAddTikTokTestHelpers } from './helpers/addTikTokTestHelpers.js';

 // Mock the permissions utility
vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

describe('addTikTokStream command', () => {
    beforeEach(() => {
        // Reset mock call history without tearing down module graph
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    const H = makeAddTikTokTestHelpers();

    it('adds a TikTok account for notifications successfully', async () => {
        const { requireAdmin } = await H.mockAdmin(true);

        const streamExistsSpy = vi.fn().mockResolvedValue(false);
        const addSpy = vi.fn().mockResolvedValue({
            tiktokUsername: 'testAccount',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined
        });

        const { command, interaction } = await H.setupCmd({
            username: 'testAccount',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                tiktokManager: {
                    streamExists: streamExistsSpy,
                    add: addSpy
                }
            }
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        H.assertAdded({
            interaction,
            requireAdmin,
            streamExistsSpy,
            addSpy,
            username: 'testAccount',
            channelId: '123456789012345678',
            guildId: '987654321098765432'
        });
    });

    it('handles accounts that are already configured', async () => {
        const { requireAdmin } = await H.mockAdmin(true);

        const streamExistsSpy = vi.fn().mockResolvedValue(true);
        const addSpy = vi.fn();

        const { command, interaction } = await H.setupCmd({
            username: 'testAccount',
            channelId: '123456789012345678',
            guildId: '987654321098765432',
            managerOverrides: {
                tiktokManager: {
                    streamExists: streamExistsSpy,
                    add: addSpy
                }
            }
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        H.assertAlreadyExists({
            interaction,
            requireAdmin,
            streamExistsSpy,
            addSpy,
            username: 'testAccount',
            channelId: '123456789012345678',
            guildId: '987654321098765432'
        });
    });

    it('handles users without admin permissions', async () => {
        const { requireAdmin } = await H.mockAdmin(false);

        const { command, interaction } = await H.setupCmd({
            guildId: '987654321098765432'
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(requireAdmin).toHaveBeenCalled();
        H.assertNoInteractionReply(interaction);
    });
});
