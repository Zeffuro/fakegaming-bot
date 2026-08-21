import type { CreationAttributes } from 'sequelize';
import { VoiceChannelOccupancyConfig } from '../models/voice-channel-occupancy-config.js';
import { BaseManager } from './baseManager.js';

export interface VoiceChannelOccupancyConfigRecord {
    guildId: string;
    channelId: string;
}

export class VoiceChannelOccupancyConfigManager extends BaseManager<VoiceChannelOccupancyConfig> {
    constructor() {
        super(VoiceChannelOccupancyConfig);
    }

    async getForGuild(guildId: string): Promise<VoiceChannelOccupancyConfigRecord | null> {
        const config = await this.model.findByPk(guildId);
        return config
            ? normalizeRecord(config.get({ plain: true }) as CreationAttributes<VoiceChannelOccupancyConfig>)
            : null;
    }

    async listConfiguredGuilds(): Promise<VoiceChannelOccupancyConfigRecord[]> {
        const configs = await this.model.findAll({ raw: true });
        return configs.map(config => normalizeRecord(
            config as unknown as CreationAttributes<VoiceChannelOccupancyConfig>,
        ));
    }

    async setForGuild(guildId: string, channelId: string): Promise<VoiceChannelOccupancyConfigRecord> {
        validateId(guildId, 'Guild');
        validateId(channelId, 'Channel');

        await this.upsert({ guildId, channelId } as CreationAttributes<VoiceChannelOccupancyConfig>);
        const config = await this.getForGuild(guildId);
        if (!config) throw new Error('Voice channel occupancy config could not be saved.');
        return config;
    }

    async disableForGuild(guildId: string): Promise<boolean> {
        validateId(guildId, 'Guild');
        return (await this.model.destroy({ where: { guildId } })) > 0;
    }
}

function normalizeRecord(row: CreationAttributes<VoiceChannelOccupancyConfig>): VoiceChannelOccupancyConfigRecord {
    const guildId = typeof row.guildId === 'string' ? row.guildId.trim() : '';
    const channelId = typeof row.channelId === 'string' ? row.channelId.trim() : '';
    validateId(guildId, 'Guild');
    validateId(channelId, 'Channel');
    return { guildId, channelId };
}

function validateId(value: string, label: string): void {
    if (!value.trim()) throw new Error(`${label} ID is required.`);
}
