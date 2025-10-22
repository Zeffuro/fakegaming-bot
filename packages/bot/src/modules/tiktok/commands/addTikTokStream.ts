import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSubscriptionCommand } from '../../../core/createSubscriptionCommand.js';
import { tiktokCommandConfig } from '../config.js';
import { addTikTokStream as META } from '../commands.manifest.js';

const { data, execute, testOnly } = createSubscriptionCommand<undefined>({
    meta: META,
    usernameOptionDescription: tiktokCommandConfig.usernameOptionDescription,
    resolveOrVerify: async (_username) => {
        return { ok: true, id: undefined } as const;
    },
    checkExistingPre: async ({ username, discordChannelId, guildId }) => {
        const normalized = username.replace(/^@/, '');
        return getConfigManager().tiktokManager.streamExists(normalized, discordChannelId, guildId);
    },
    addSubscription: async ({ username, externalId: _externalId, discordChannelId, guildId, customMessage }) => {
        const normalized = username.replace(/^@/, '');
        await getConfigManager().tiktokManager.add({
            tiktokUsername: normalized,
            discordChannelId,
            guildId,
            customMessage,
        });
    },
    successMessage: tiktokCommandConfig.successMessage,
    alreadyConfiguredMessage: tiktokCommandConfig.alreadyConfiguredMessage,
    notFoundMessage: tiktokCommandConfig.notFoundMessage,
});

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
