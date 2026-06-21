import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {manageYoutubeChannels as META} from '../commands.manifest.js';

interface YoutubeManagementRecord extends IntegrationManagementRecord {
    youtubeChannelId: string;
}

const {data, execute, testOnly} = createIntegrationManagementCommand<YoutubeManagementRecord>({
    meta: META,
    subjectSingular: 'YouTube channel',
    subjectPlural: 'YouTube channels',
    listRecords: async (guildId) => {
        const records = await getConfigManager().youtubeManager.getManyPlain({guildId});
        return records as unknown as YoutubeManagementRecord[];
    },
    getRecord: async (id) => {
        const record = await getConfigManager().youtubeManager.getOnePlain({id});
        return record as unknown as YoutubeManagementRecord | null;
    },
    removeRecord: async (id) => {
        await getConfigManager().youtubeManager.removeByPk(id);
    },
    formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.youtubeChannelId)} -> <#${record.discordChannelId}>`,
    describeRecord: (record) => `${inlineCode(record.youtubeChannelId)} from <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'youtube.delete',
        targetType: 'youtubeConfig',
        metadata: (record) => ({channelId: record.discordChannelId, youtubeChannelId: record.youtubeChannelId}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
