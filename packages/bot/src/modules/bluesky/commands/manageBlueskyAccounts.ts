import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {manageBlueskyAccounts as META} from '../commands.manifest.js';

interface BlueskyManagementRecord extends IntegrationManagementRecord {
    blueskyHandle: string;
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
    formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.blueskyHandle)} -> <#${record.discordChannelId}>`,
    describeRecord: (record) => `${inlineCode(record.blueskyHandle)} from <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'bluesky.delete',
        targetType: 'blueskyConfig',
        metadata: (record) => ({channelId: record.discordChannelId, blueskyHandle: record.blueskyHandle}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
