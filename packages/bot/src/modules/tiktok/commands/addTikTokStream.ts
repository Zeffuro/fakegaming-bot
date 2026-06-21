import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSubscriptionCommand } from '../../../core/createSubscriptionCommand.js';
import { tiktokCommandConfig } from '../config.js';
import { addTikTokStream as META } from '../commands.manifest.js';

function normalizeUsername(input: string): string {
    return input.replace(/^@/, '');
}

const { data, execute, testOnly } = createSubscriptionCommand<undefined>({
    meta: META,
    usernameOptionDescription: tiktokCommandConfig.usernameOptionDescription,
    resolveOrVerify: async (_username) => {
        return { ok: true, id: undefined } as const;
    },
    checkExistingPre: async ({ username, discordChannelId, guildId }) => {
        return getConfigManager().tiktokManager.streamExists(normalizeUsername(username), discordChannelId, guildId);
    },
    addSubscription: async ({ username, externalId: _externalId, discordChannelId, guildId, customMessage }) => {
        const normalized = normalizeUsername(username);
        await getConfigManager().tiktokManager.add({
            tiktokUsername: normalized,
            discordChannelId,
            guildId,
            customMessage,
        });
    },
    auditAdd: {
        action: 'tiktok.create',
        targetType: 'tiktokConfig',
        targetId: ({ username }) => normalizeUsername(username),
        metadata: ({ username, discordChannelId }) => ({
            channelId: discordChannelId,
            tiktokUsername: normalizeUsername(username),
        }),
    },
    successMessage: tiktokCommandConfig.successMessage,
    alreadyConfiguredMessage: tiktokCommandConfig.alreadyConfiguredMessage,
    notFoundMessage: tiktokCommandConfig.notFoundMessage,
});

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
