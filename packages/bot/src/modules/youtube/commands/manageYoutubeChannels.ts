import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {manageYoutubeChannels as META} from '../commands.manifest.js';

interface YoutubeManagementRecord extends IntegrationManagementRecord {
    youtubeChannelId: string;
    paused?: boolean | null;
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
    setPausedRecord: async (id, paused) => {
        await getConfigManager().youtubeManager.setPaused(id, paused);
    },
    formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.youtubeChannelId)} -> <#${record.discordChannelId}>`,
    describeRecord: (record) => `${inlineCode(record.youtubeChannelId)} from <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'youtube.delete',
        targetType: 'youtubeConfig',
        metadata: (record) => ({channelId: record.discordChannelId, youtubeChannelId: record.youtubeChannelId}),
    },
    auditPause: {
        pauseAction: 'youtube.pause',
        resumeAction: 'youtube.resume',
        targetType: 'youtubeConfig',
        metadata: (record, paused) => ({channelId: record.discordChannelId, youtubeChannelId: record.youtubeChannelId, paused}),
    },
    health: {
        provider: 'youtube',
        metadata: (record, paused) => ({youtubeChannelId: record.youtubeChannelId, paused}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
