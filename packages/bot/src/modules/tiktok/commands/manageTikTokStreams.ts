import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../../shared/integrationManagementCommand.js';
import {manageTikTokStreams as META} from '../commands.manifest.js';

interface TikTokManagementRecord extends IntegrationManagementRecord {
    tiktokUsername: string;
    isLive?: boolean | null;
    paused?: boolean | null;
}

const {data, execute, testOnly} = createIntegrationManagementCommand<TikTokManagementRecord>({
    meta: META,
    subjects: {
        singular: { en: 'TikTok stream', nl: 'TikTok-stream' },
        plural: { en: 'TikTok streams', nl: 'TikTok-streams' },
    },
    listRecords: async (guildId) => {
        const records = await getConfigManager().tiktokManager.getManyPlain({guildId});
        return records as unknown as TikTokManagementRecord[];
    },
    getRecord: async (id) => {
        const record = await getConfigManager().tiktokManager.getOnePlain({id});
        return record as unknown as TikTokManagementRecord | null;
    },
    removeRecord: async (id) => {
        await getConfigManager().tiktokManager.removeByPk(id);
    },
    setPausedRecord: async (id, paused) => {
        await getConfigManager().tiktokManager.setPaused(id, paused);
    },
    formatRecord: (record) => {
        const liveState = record.isLive ? ' live' : '';
        return `${inlineCode(String(record.id))} ${inlineCode(record.tiktokUsername)} -> <#${record.discordChannelId}>${liveState}`;
    },
    describeRecord: (record, locale) => `${inlineCode(record.tiktokUsername)} ${resolveLocaleValue(locale, { en: 'from', nl: 'uit' })} <#${record.discordChannelId}>`,
    auditRemove: {
        action: 'tiktok.delete',
        targetType: 'tiktokConfig',
        metadata: (record) => ({channelId: record.discordChannelId, tiktokUsername: record.tiktokUsername}),
    },
    auditPause: {
        pauseAction: 'tiktok.pause',
        resumeAction: 'tiktok.resume',
        targetType: 'tiktokConfig',
        metadata: (record, paused) => ({channelId: record.discordChannelId, tiktokUsername: record.tiktokUsername, paused}),
    },
    health: {
        provider: 'tiktok',
        metadata: (record, paused) => ({tiktokUsername: record.tiktokUsername, paused}),
    },
});

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
