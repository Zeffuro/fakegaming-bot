import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSubscriptionCommand } from '../../../core/createSubscriptionCommand.js';
import { verifyBlueskyHandleApi } from '../../../utils/apiClient.js';
import { blueskyCommandConfig } from '../config.js';
import { addBlueskyAccount as META } from '../commands.manifest.js';

function normalizeHandle(input: string): string {
    return input.trim().replace(/^@/, '').toLowerCase();
}

const { data, execute, testOnly } = createSubscriptionCommand<string>({
    meta: META,
    usernameOptionDescription: blueskyCommandConfig.usernameOptionDescription,
    resolveOrVerify: async (username) => {
        const result = await verifyBlueskyHandleApi(normalizeHandle(username));
        return result?.exists && result.handle ? { ok: true, id: result.handle } : { ok: false };
    },
    checkExistingPre: async ({ username, discordChannelId, guildId }) => {
        return getConfigManager().blueskyManager.accountExists(normalizeHandle(username), discordChannelId, guildId);
    },
    addSubscription: async ({ username: _username, externalId, discordChannelId, guildId, customMessage }) => {
        await getConfigManager().blueskyManager.add({
            blueskyHandle: normalizeHandle(externalId),
            discordChannelId,
            guildId,
            customMessage,
        });
    },
    auditAdd: {
        action: 'bluesky.create',
        targetType: 'blueskyConfig',
        targetId: ({ externalId }) => normalizeHandle(externalId),
        metadata: ({ externalId, discordChannelId }) => ({
            channelId: discordChannelId,
            blueskyHandle: normalizeHandle(externalId),
        }),
    },
    successMessage: blueskyCommandConfig.successMessage,
    alreadyConfiguredMessage: blueskyCommandConfig.alreadyConfiguredMessage,
    notFoundMessage: blueskyCommandConfig.notFoundMessage,
});

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
