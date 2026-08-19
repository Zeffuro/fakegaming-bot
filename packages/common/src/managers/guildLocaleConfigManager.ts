import type { CreationAttributes } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { GuildLocaleConfig } from '../models/guild-locale-config.js';
import {
    DEFAULT_OUTPUT_LOCALE,
    isSupportedOutputLocale,
    type SupportedOutputLocale,
} from '../utils/outputLocale.js';

export interface GuildLocaleConfigRecord {
    guildId: string;
    outputLocale: SupportedOutputLocale;
}

export class GuildLocaleConfigManager extends BaseManager<GuildLocaleConfig> {
    constructor() {
        super(GuildLocaleConfig);
    }

    async getLocaleConfig(guildId: string): Promise<GuildLocaleConfigRecord | null> {
        const config = await this.model.findByPk(guildId);
        return config ? normalizeRecord(config.get({ plain: true }) as CreationAttributes<GuildLocaleConfig>) : null;
    }

    async getOutputLocale(guildId: string): Promise<SupportedOutputLocale> {
        const config = await this.getLocaleConfig(guildId);
        return config?.outputLocale ?? DEFAULT_OUTPUT_LOCALE;
    }

    async setOutputLocale(guildId: string, outputLocale: SupportedOutputLocale): Promise<GuildLocaleConfigRecord> {
        if (!guildId.trim()) throw new Error('Guild ID is required.');
        if (!isSupportedOutputLocale(outputLocale)) throw new Error('Output locale is not supported.');

        await this.upsert({ guildId, outputLocale } as CreationAttributes<GuildLocaleConfig>);
        const config = await this.getLocaleConfig(guildId);
        if (!config) throw new Error('Guild locale config could not be saved.');
        return config;
    }
}

function normalizeRecord(row: CreationAttributes<GuildLocaleConfig>): GuildLocaleConfigRecord {
    const guildId = typeof row.guildId === 'string' ? row.guildId : '';
    if (!guildId) throw new Error('Guild locale config has an invalid guild ID.');
    if (!isSupportedOutputLocale(row.outputLocale)) {
        throw new Error(`Guild locale config for '${guildId}' has an unsupported output locale.`);
    }

    return { guildId, outputLocale: row.outputLocale };
}
