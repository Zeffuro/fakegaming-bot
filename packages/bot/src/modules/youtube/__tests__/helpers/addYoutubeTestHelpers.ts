// filepath: packages/bot/src/modules/youtube/__tests__/helpers/addYoutubeTestHelpers.ts
import { expectEphemeralReply, expectReplyText } from '@zeffuro/fakegaming-common/testing';
import { vi, expect } from 'vitest';
import { makeChannelNotifyTestHelpers } from '../../../shared/__tests__/helpers/channelNotifyTestHelpers.js';

export function makeAddYoutubeTestHelpers() {
    const shared = makeChannelNotifyTestHelpers();

    async function setupCmd(options: {
        username?: string;
        channelId?: string;
        guildId?: string;
        managerOverrides?: Record<string, unknown>;
    } = {}) {
        return shared.setupAddCommand('modules/youtube/commands/addYoutubeVideoChannel.js', options);
    }

    async function mockAdmin(allowed: boolean) {
        const { requireAdmin } = await import('../../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(allowed);
        return { requireAdmin } as const;
    }

    async function mockGetChannelId(value: string | null) {
        const { getYoutubeChannelId } = await import('../../../../services/youtubeService.js');
        vi.mocked(getYoutubeChannelId).mockResolvedValue(value as never);
        return { getYoutubeChannelId } as const;
    }

    function assertAdded(params: {
        interaction: unknown;
        requireAdmin: unknown;
        getYoutubeChannelId: unknown;
        getVideoChannelSpy: unknown;
        addSpy: unknown;
        username: string;
        channelId: string;
        guildId: string;
        youtubeChannelId: string;
    }) {
        const { interaction, requireAdmin, getYoutubeChannelId, getVideoChannelSpy, addSpy, username, channelId, guildId, youtubeChannelId } = params;

        // Permissions checked
        expect(requireAdmin).toHaveBeenCalledWith(interaction);
        // Service call
        expect(getYoutubeChannelId).toHaveBeenCalledWith(username);
        // Manager queried and updated
        expect(getVideoChannelSpy).toHaveBeenCalledWith({
            youtubeChannelId,
            discordChannelId: channelId,
            guildId
        });
        expect(addSpy).toHaveBeenCalledWith({
            youtubeChannelId,
            discordChannelId: channelId,
            guildId,
            lastVideoId: undefined,
            customMessage: undefined
        });
        // Reply assertion
        expectReplyText(interaction, `Youtube channel \`${username}\` added for video notifications in #${channelId}.`);
    }

    function assertAlreadyExists(params: {
        interaction: unknown;
        requireAdmin: unknown;
        getYoutubeChannelId: unknown;
        getVideoChannelSpy: unknown;
        addSpy: unknown;
        username: string;
        channelId: string;
        guildId: string;
        youtubeChannelId: string;
    }) {
        const { interaction, requireAdmin, getYoutubeChannelId, getVideoChannelSpy, addSpy, username, channelId, guildId, youtubeChannelId } = params;

        expect(requireAdmin).toHaveBeenCalledWith(interaction);
        expect(getYoutubeChannelId).toHaveBeenCalledWith(username);
        expect(getVideoChannelSpy).toHaveBeenCalledWith({
            youtubeChannelId,
            discordChannelId: channelId,
            guildId
        });
        expect(addSpy).not.toHaveBeenCalled();
        expectEphemeralReply(interaction as never, { equals: `Youtube channel \`${username}\` is already configured for video notifications in this channel.` });
    }

    function assertNonexistent(params: {
        interaction: unknown;
        requireAdmin: unknown;
        getYoutubeChannelId: unknown;
        username: string;
    }) {
        const { interaction, requireAdmin, getYoutubeChannelId, username } = params;

        expect(requireAdmin).toHaveBeenCalledWith(interaction);
        expect(getYoutubeChannelId).toHaveBeenCalledWith(username);
        expectEphemeralReply(interaction as never, { equals: `Youtube channel \`${username}\` does not exist.` });
    }

    return {
        setupCmd,
        mockAdmin,
        mockGetChannelId,
        assertAdded,
        assertAlreadyExists,
        assertNonexistent
    } as const;
}
