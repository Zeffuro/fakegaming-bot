import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {manageTwitchStreams as META} from '../commands.manifest.js';

interface TwitchManagementRecord extends IntegrationManagementRecord {
    twitchUsername: string;
    isLive?: boolean | null;
}

const {data, execute, testOnly} = createIntegrationManagementCommand<TwitchManagementRecord>({
    meta: META,
    subjectSingular: 'Twitch stream',
    subjectPlural: 'Twitch streams',
    listRecords: async (guildId) => {
        const records = await getConfigManager().twitchManager.getManyPlain({guildId});
        return records as unknown as TwitchManagementRecord[];
    },
    getRecord: async (id) => {
        const record = await getConfigManager().twitchManager.getOnePlain({id});
        return record as unknown as TwitchManagementRecord | null;
    },
    removeRecord: async (id) => {
        await getConfigManager().twitchManager.removeByPk(id);
    },
    formatRecord: (record) => {
        const liveState = record.isLive ? ' live' : '';
        return `${inlineCode(String(record.id))} ${inlineCode(record.twitchUsername)} -> <#${record.discordChannelId}>${liveState}`;
    },
    describeRecord: (record) => `${inlineCode(record.twitchUsername)} from <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'twitch.delete',
        targetType: 'twitchConfig',
        metadata: (record) => ({channelId: record.discordChannelId, twitchUsername: record.twitchUsername}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
