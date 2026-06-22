import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import { manageSteamNews as META } from '../commands.manifest.js';

interface SteamNewsManagementRecord extends IntegrationManagementRecord {
    steamAppId: number;
    appName?: string | null;
    paused?: boolean | null;
}

interface SteamNewsSubscriptionRecord {
    id?: number;
    steamAppId: number;
    appName?: string | null;
    guildId: string;
    discordChannelId: string;
    paused?: boolean | null;
}

function toManagementRecord(record: SteamNewsSubscriptionRecord): SteamNewsManagementRecord {
    return {
        id: record.id ?? 0,
        steamAppId: record.steamAppId,
        appName: record.appName ?? null,
        guildId: record.guildId,
        discordChannelId: record.discordChannelId,
        paused: record.paused,
    };
}

function appLabel(record: SteamNewsManagementRecord): string {
    return record.appName?.trim() || `Steam app ${record.steamAppId}`;
}

const { data, execute, testOnly } = createIntegrationManagementCommand<SteamNewsManagementRecord>({
    meta: META,
    subjectSingular: 'Steam news subscription',
    subjectPlural: 'Steam news subscriptions',
    listRecords: async (guildId) => {
        const records = await getConfigManager().steamNewsSubscriptionManager.getManyPlain({ guildId } as never) as unknown as SteamNewsSubscriptionRecord[];
        return records.map(toManagementRecord);
    },
    getRecord: async (id) => {
        const record = await getConfigManager().steamNewsSubscriptionManager.getOnePlain({ id } as never) as unknown as SteamNewsSubscriptionRecord | null;
        return record ? toManagementRecord(record) : null;
    },
    removeRecord: async (id) => {
        await getConfigManager().steamNewsSubscriptionManager.removeByPk(id);
    },
    setPausedRecord: async (id, paused) => {
        await getConfigManager().steamNewsSubscriptionManager.setPaused(id, paused);
    },
    formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(appLabel(record))} (${record.steamAppId}) -> <#${record.discordChannelId}>`,
    describeRecord: (record) => `${inlineCode(appLabel(record))} in <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'steamNewsSubscription.delete',
        targetType: 'steamNewsSubscription',
        metadata: (record) => ({ channelId: record.discordChannelId, steamAppId: record.steamAppId, appName: record.appName ?? null }),
    },
    auditPause: {
        pauseAction: 'steamNewsSubscription.pause',
        resumeAction: 'steamNewsSubscription.resume',
        targetType: 'steamNewsSubscription',
        metadata: (record, paused) => ({ channelId: record.discordChannelId, steamAppId: record.steamAppId, appName: record.appName ?? null, paused }),
    },
    health: {
        provider: 'steamnews',
        metadata: (record, paused) => ({ steamAppId: record.steamAppId, appName: record.appName ?? null, paused }),
    },
});

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
