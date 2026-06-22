import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {managePatchnotes as META} from '../commands.manifest.js';

interface PatchNoteManagementRecord extends IntegrationManagementRecord {
    game: string;
}

interface PatchSubscriptionRecord {
    id?: number;
    game: string;
    guildId: string;
    channelId: string;
    paused?: boolean | null;
}

function toManagementRecord(record: PatchSubscriptionRecord): PatchNoteManagementRecord {
    return {
        id: record.id ?? 0,
        game: record.game,
        guildId: record.guildId,
        discordChannelId: record.channelId,
        paused: record.paused,
    };
}

const {data, execute, testOnly} = createIntegrationManagementCommand<PatchNoteManagementRecord>({
    meta: META,
    subjectSingular: 'patch note subscription',
    subjectPlural: 'patch note subscriptions',
    listRecords: async (guildId) => {
        const records = await getConfigManager().patchSubscriptionManager.getManyPlain({guildId}) as unknown as PatchSubscriptionRecord[];
        return records.map(toManagementRecord);
    },
    getRecord: async (id) => {
        const record = await getConfigManager().patchSubscriptionManager.getOnePlain({id}) as unknown as PatchSubscriptionRecord | null;
        return record ? toManagementRecord(record) : null;
    },
    removeRecord: async (id) => {
        await getConfigManager().patchSubscriptionManager.removeByPk(id);
    },
    setPausedRecord: async (id, paused) => {
        await getConfigManager().patchSubscriptionManager.setPaused(id, paused);
    },
    formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.game)} -> <#${record.discordChannelId}>`,
    describeRecord: (record) => `${inlineCode(record.game)} in <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'patchSubscription.delete',
        targetType: 'patchSubscription',
        metadata: (record) => ({channelId: record.discordChannelId, game: record.game}),
    },
    auditPause: {
        pauseAction: 'patchSubscription.pause',
        resumeAction: 'patchSubscription.resume',
        targetType: 'patchSubscription',
        metadata: (record, paused) => ({channelId: record.discordChannelId, game: record.game, paused}),
    },
    health: {
        provider: 'patchnotes',
        metadata: (record, paused) => ({game: record.game, paused}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
