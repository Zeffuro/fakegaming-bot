import { BaseManager } from './baseManager.js';
import { DisabledModuleConfig } from '../models/disabled-module-config.js';

export class DisabledModuleManager extends BaseManager<DisabledModuleConfig> {
    constructor() {
        super(DisabledModuleConfig);
    }

    async isModuleDisabled(guildId: string, moduleName: string): Promise<boolean> {
        return !!(await this.getOne({ guildId, moduleName }));
    }
}

