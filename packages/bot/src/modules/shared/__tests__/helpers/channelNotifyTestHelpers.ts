// filepath: packages/bot/src/modules/shared/__tests__/helpers/channelNotifyTestHelpers.ts
import { setupCommandTest, expectEphemeralReply, expectReplyText } from '@zeffuro/fakegaming-common/testing';

export interface SetupOptions {
    username?: string;
    channelId?: string;
    guildId?: string;
    managerOverrides?: Record<string, unknown>;
}

/**
 * Shared tiny helpers for channel notification add-command tests (e.g., YouTube/Twitch).
 * Keeps suite-specific helper APIs intact by providing common building blocks.
 */
export function makeChannelNotifyTestHelpers() {
    async function setupAddCommand(commandPath: string, options: SetupOptions = {}) {
        const username = options.username ?? 'testChannel';
        const channelId = options.channelId ?? '123456789012345678';
        const guildId = options.guildId ?? '987654321098765432';

        return setupCommandTest(commandPath, {
            interaction: {
                stringOptions: { username },
                channelOptions: { channel: channelId },
                guildId
            },
            managerOverrides: options.managerOverrides
        });
    }

    function expectSuccessReply(interaction: unknown, text: string) {
        expectReplyText(interaction, text);
    }

    function expectEphemeralEquals(interaction: unknown, text: string) {
        expectEphemeralReply(interaction as never, { equals: text });
    }

    return {
        setupAddCommand,
        expectSuccessReply,
        expectEphemeralEquals
    } as const;
}
