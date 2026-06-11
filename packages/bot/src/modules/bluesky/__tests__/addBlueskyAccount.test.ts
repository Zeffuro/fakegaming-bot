import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { expectEphemeralReply, expectNoReply, expectReplyText, setupCommandTest } from '@zeffuro/fakegaming-common/testing';

vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

vi.mock('../../../utils/apiClient.js', () => ({
    verifyBlueskyHandleApi: vi.fn()
}));

describe('addBlueskyAccount command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    async function mockAdmin(allowed: boolean) {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(allowed);
        return { requireAdmin } as const;
    }

    async function mockProfile(exists: boolean, handle = 'bsky.app') {
        const { verifyBlueskyHandleApi } = await import('../../../utils/apiClient.js');
        vi.mocked(verifyBlueskyHandleApi).mockResolvedValue(exists ? { exists: true, handle } : { exists: false });
        return { verifyBlueskyHandleApi } as const;
    }

    async function setupCmd(options: {
        username?: string;
        channelId?: string;
        guildId?: string;
        managerOverrides?: Record<string, unknown>;
    } = {}) {
        const username = options.username ?? '@bsky.app';
        const channelId = options.channelId ?? '123456789012345678';
        const guildId = options.guildId ?? '987654321098765432';
        return setupCommandTest('modules/bluesky/commands/addBlueskyAccount.js', {
            interaction: {
                stringOptions: { username },
                channelOptions: { channel: channelId },
                guildId
            },
            managerOverrides: options.managerOverrides
        });
    }

    it('adds a Bluesky account for notifications successfully', async () => {
        const { requireAdmin } = await mockAdmin(true);
        const { verifyBlueskyHandleApi } = await mockProfile(true, 'bsky.app');
        const accountExistsSpy = vi.fn().mockResolvedValue(false);
        const addSpy = vi.fn().mockResolvedValue(undefined);

        const { command, interaction } = await setupCmd({
            managerOverrides: {
                blueskyManager: {
                    accountExists: accountExistsSpy,
                    add: addSpy
                }
            }
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(requireAdmin).toHaveBeenCalled();
        expect(accountExistsSpy).toHaveBeenCalledWith('bsky.app', '123456789012345678', '987654321098765432');
        expect(verifyBlueskyHandleApi).toHaveBeenCalledWith('bsky.app');
        expect(addSpy).toHaveBeenCalledWith({
            blueskyHandle: 'bsky.app',
            discordChannelId: '123456789012345678',
            guildId: '987654321098765432',
            customMessage: undefined
        });
        expectReplyText(interaction, 'Bluesky account `@bsky.app` added for notifications in <#123456789012345678>.');
    });

    it('handles accounts that are already configured', async () => {
        const { requireAdmin } = await mockAdmin(true);
        const accountExistsSpy = vi.fn().mockResolvedValue(true);
        const addSpy = vi.fn();

        const { command, interaction } = await setupCmd({
            managerOverrides: {
                blueskyManager: {
                    accountExists: accountExistsSpy,
                    add: addSpy
                }
            }
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(requireAdmin).toHaveBeenCalled();
        expect(addSpy).not.toHaveBeenCalled();
        expectEphemeralReply(interaction as never, { equals: 'Bluesky account `@bsky.app` is already configured for notifications in this channel.' });
    });

    it('handles users without admin permissions', async () => {
        const { requireAdmin } = await mockAdmin(false);
        const { command, interaction } = await setupCmd();

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(requireAdmin).toHaveBeenCalled();
        expectNoReply(interaction);
    });
});
