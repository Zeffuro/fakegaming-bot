import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {getYoutubeChannelId} from '../../../services/youtubeService.js';
import { createSubscriptionCommand } from '../../../core/createSubscriptionCommand.js';
import { youtubeCommandConfig } from '../config.js';
import { addYoutubeChannel as META } from '../commands.manifest.js';

const { data, execute, testOnly } = createSubscriptionCommand<string>({
    meta: META,
    usernameOptionDescription: youtubeCommandConfig.usernameOptionDescription,
    resolveOrVerify: async (username) => {
        const youtubeChannelId = await getYoutubeChannelId(username);
        return youtubeChannelId ? { ok: true, id: youtubeChannelId } : { ok: false };
    },
    checkExistingPost: async ({ username: _username, externalId, discordChannelId, guildId }) => {
        const existing = await getConfigManager().youtubeManager.getVideoChannel({
            youtubeChannelId: externalId,
            discordChannelId,
            guildId,
        });
        return Boolean(existing);
    },
    addSubscription: async ({ username: _username, externalId, discordChannelId, guildId, customMessage }) => {
        await getConfigManager().youtubeManager.add({
            youtubeChannelId: externalId,
            discordChannelId,
            guildId,
            lastVideoId: undefined,
            customMessage,
        });
    },
    successMessage: youtubeCommandConfig.successMessage,
    alreadyConfiguredMessage: youtubeCommandConfig.alreadyConfiguredMessage,
    notFoundMessage: youtubeCommandConfig.notFoundMessage,
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};