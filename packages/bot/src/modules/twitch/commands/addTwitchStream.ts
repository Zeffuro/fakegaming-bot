import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {verifyTwitchUser} from '../../../services/twitchService.js';
import { createSubscriptionCommand } from '../../../core/createSubscriptionCommand.js';
import { twitchCommandConfig } from '../config.js';
import { addTwitchStream as META } from '../commands.manifest.js';

const { data, execute, testOnly } = createSubscriptionCommand<undefined>({
    meta: META,
    usernameOptionDescription: twitchCommandConfig.usernameOptionDescription,
    resolveOrVerify: async (username) => {
        const exists = await verifyTwitchUser(username);
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
    successMessage: twitchCommandConfig.successMessage,
    alreadyConfiguredMessage: twitchCommandConfig.alreadyConfiguredMessage,
    notFoundMessage: twitchCommandConfig.notFoundMessage,
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};