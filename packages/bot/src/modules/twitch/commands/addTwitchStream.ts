import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import { verifyTwitchUsernameApi } from '../../../utils/apiClient.js';
import { createSubscriptionCommand } from '../../../core/createSubscriptionCommand.js';
import { twitchCommandConfig } from '../config.js';
import { addTwitchStream as META } from '../commands.manifest.js';

const { data, execute, testOnly } = createSubscriptionCommand<undefined>({
    meta: META,
    usernameOptionDescriptions: twitchCommandConfig.usernameOptionDescriptions,
    resolveOrVerify: async (username) => {
        const result = await verifyTwitchUsernameApi(username);
        const exists = !!result && result.exists;
        return exists ? { ok: true, id: undefined } : { ok: false };
    },
    checkExistingPre: async ({ username, discordChannelId, guildId }) => {
        return getConfigManager().twitchManager.streamExists(username, discordChannelId, guildId);
    },
    addSubscription: async ({ username, externalId: _externalId, discordChannelId, guildId, customMessage }) => {
        await getConfigManager().twitchManager.add({
            twitchUsername: username,
            discordChannelId,
            guildId,
            customMessage,
        });
    },
    auditAdd: {
        action: 'twitch.create',
        targetType: 'twitchConfig',
        targetId: ({ username }) => username,
        metadata: ({ username, discordChannelId }) => ({
            channelId: discordChannelId,
            twitchUsername: username,
        }),
    },
    successMessages: twitchCommandConfig.successMessages,
    alreadyConfiguredMessages: twitchCommandConfig.alreadyConfiguredMessages,
    notFoundMessages: twitchCommandConfig.notFoundMessages,
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
