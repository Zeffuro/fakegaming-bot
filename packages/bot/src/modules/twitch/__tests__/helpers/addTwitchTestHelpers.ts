import { expectEphemeralReply, expectReplyText, expectNoReply } from '@zeffuro/fakegaming-common/testing';
import { vi, expect } from 'vitest';
import { makeChannelNotifyTestHelpers } from '../../../shared/__tests__/helpers/channelNotifyTestHelpers.js';

/**
 * Helper factory for addTwitchStream tests.
 */
export const makeAddTwitchTestHelpers = () => {
    const shared = makeChannelNotifyTestHelpers();

    async function setupCmd(options: {
        username?: string;
        channelId?: string;
        guildId?: string;
        managerOverrides?: Record<string, unknown>;
    } = {}) {
        return shared.setupAddCommand('modules/twitch/commands/addTwitchStream.js', options);
    }

    async function mockAdmin(allowed: boolean) {
        const { requireAdmin } = await import('../../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(allowed);
        return { requireAdmin } as const;
    }

    async function mockVerifyUser(exists: boolean) {
        const { verifyTwitchUsernameApi } = await import('../../../../utils/apiClient.js');
        vi.mocked(verifyTwitchUsernameApi).mockResolvedValue({ exists } as never);
        return { verifyTwitchUsernameApi } as const;
    }

    function assertAdded(params: {
        interaction: unknown;
        requireAdmin: unknown;
        verifyTwitchUsernameApi: unknown;
        streamExistsSpy: unknown;
        addSpy: unknown;
        username: string;
        channelId: string;
        guildId: string;
    }) {
        const { interaction, requireAdmin, verifyTwitchUsernameApi, streamExistsSpy, addSpy, username, channelId, guildId } = params;

        expect(requireAdmin).toHaveBeenCalled();
        expect(streamExistsSpy).toHaveBeenCalledWith(username, channelId, guildId);
        expect(verifyTwitchUsernameApi).toHaveBeenCalledWith(username);
        expect(addSpy).toHaveBeenCalledWith({
            twitchUsername: username,
            discordChannelId: channelId,
            guildId,
            customMessage: undefined
        });
        expectReplyText(interaction, `Twitch stream \`${username}\` added for notifications in <#${channelId}>.`);
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
        expect(streamExistsSpy).toHaveBeenCalledWith(username, channelId, guildId);
        expect(addSpy).not.toHaveBeenCalled();
        expectEphemeralReply(interaction as never, { equals: `Twitch stream \`${username}\` is already configured for notifications in this channel.` });
    }

    function assertNonexistent(params: {
        interaction: unknown;
        requireAdmin: unknown;
        verifyTwitchUsernameApi: unknown;
        streamExistsSpy: unknown;
        addSpy: unknown;
        username: string;
        channelId: string;
        guildId: string;
    }) {
        const { interaction, requireAdmin, verifyTwitchUsernameApi, streamExistsSpy, addSpy, username, channelId, guildId } = params;

        expect(requireAdmin).toHaveBeenCalled();
        expect(streamExistsSpy).toHaveBeenCalledWith(username, channelId, guildId);
        expect(verifyTwitchUsernameApi).toHaveBeenCalledWith(username);
        expect(addSpy).not.toHaveBeenCalled();
        expectEphemeralReply(interaction as never, { equals: `Twitch user \`${username}\` does not exist.` });
    }

    function assertNoInteractionReply(interaction: unknown, _note?: string) {
        expectNoReply(interaction);
    }

    return {
        setupCmd,
        mockAdmin,
        mockVerifyUser,
        assertAdded,
        assertAlreadyExists,
        assertNonexistent,
        assertNoInteractionReply
    } as const;
};
