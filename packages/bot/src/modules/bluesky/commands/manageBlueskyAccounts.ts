import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {manageBlueskyAccounts as META} from '../commands.manifest.js';

interface BlueskyManagementRecord extends IntegrationManagementRecord {
    blueskyHandle: string;
    paused?: boolean | null;
}

const {data, execute, testOnly} = createIntegrationManagementCommand<BlueskyManagementRecord>({
    meta: META,
    subjectSingular: 'Bluesky account',
    subjectPlural: 'Bluesky accounts',
    listRecords: async (guildId) => {
        const records = await getConfigManager().blueskyManager.getManyPlain({guildId});
        return records as unknown as BlueskyManagementRecord[];
    },
    getRecord: async (id) => {
        const record = await getConfigManager().blueskyManager.getOnePlain({id});
        return record as unknown as BlueskyManagementRecord | null;
    },
    removeRecord: async (id) => {
        await getConfigManager().blueskyManager.removeByPk(id);
    },
    setPausedRecord: async (id, paused) => {
        await getConfigManager().blueskyManager.setPaused(id, paused);
    },
    formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.blueskyHandle)} -> <#${record.discordChannelId}>`,
    describeRecord: (record) => `${inlineCode(record.blueskyHandle)} from <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'bluesky.delete',
        targetType: 'blueskyConfig',
        metadata: (record) => ({channelId: record.discordChannelId, blueskyHandle: record.blueskyHandle}),
    },
    auditPause: {
        pauseAction: 'bluesky.pause',
        resumeAction: 'bluesky.resume',
        targetType: 'blueskyConfig',
        metadata: (record, paused) => ({channelId: record.discordChannelId, blueskyHandle: record.blueskyHandle, paused}),
    },
    health: {
        provider: 'bluesky',
        metadata: (record, paused) => ({blueskyHandle: record.blueskyHandle, paused}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
