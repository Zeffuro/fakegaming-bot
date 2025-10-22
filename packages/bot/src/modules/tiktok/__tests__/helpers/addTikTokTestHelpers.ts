import { expectEphemeralReply, expectReplyText, expectNoReply } from '@zeffuro/fakegaming-common/testing';
import { vi, expect } from 'vitest';
import { makeChannelNotifyTestHelpers } from '../../../shared/__tests__/helpers/channelNotifyTestHelpers.js';

/**
 * Helper factory for addTikTokStream tests.
 */
export const makeAddTikTokTestHelpers = () => {
    const shared = makeChannelNotifyTestHelpers();

    async function setupCmd(options: {
        username?: string;
        channelId?: string;
        guildId?: string;
        managerOverrides?: Record<string, unknown>;
    } = {}) {
        return shared.setupAddCommand('modules/tiktok/commands/addTikTokStream.js', options);
    }

    async function mockAdmin(allowed: boolean) {
        const { requireAdmin } = await import('../../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(allowed);
        return { requireAdmin } as const;
    }

    function assertAdded(params: {
        interaction: unknown;
        requireAdmin: unknown;
        streamExistsSpy: unknown;
        addSpy: unknown;
        username: string;
        channelId: string;
        guildId: string;
    }) {
        const { interaction, requireAdmin, streamExistsSpy, addSpy, username, channelId, guildId } = params;

        expect(requireAdmin).toHaveBeenCalled();
        expect(streamExistsSpy).toHaveBeenCalledWith(username.replace(/^@/, ''), channelId, guildId);
        expect(addSpy).toHaveBeenCalledWith({
            tiktokUsername: username.replace(/^@/, ''),
            discordChannelId: channelId,
            guildId,
            customMessage: undefined
        });
        expectReplyText(interaction, `TikTok account \`${username}\` added for notifications in <#${channelId}>.`);
    }

    function assertAlreadyExists(params: {
        interaction: unknown;
        requireAdmin: unknown;
        streamExistsSpy: unknown;
        addSpy: unknown;
        username: string;
        channelId: string;
        guildId: string;
    }) {
        const { interaction, requireAdmin, streamExistsSpy, addSpy, username, channelId, guildId } = params;

        expect(requireAdmin).toHaveBeenCalled();
        expect(streamExistsSpy).toHaveBeenCalledWith(username.replace(/^@/, ''), channelId, guildId);
        expect(addSpy).not.toHaveBeenCalled();
        expectEphemeralReply(interaction as never, { equals: `TikTok account \`${username}\` is already configured for notifications in this channel.` });
    }

    function assertNoInteractionReply(interaction: unknown, _note?: string) {
        expectNoReply(interaction);
    }

    return {
        setupCmd,
        mockAdmin,
        assertAdded,
        assertAlreadyExists,
        assertNoInteractionReply
    } as const;
};
