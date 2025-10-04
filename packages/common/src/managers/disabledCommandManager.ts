import {BaseManager} from './baseManager.js';
import {DisabledCommandConfig} from '../models/disabled-command-config.js';

export class DisabledCommandManager extends BaseManager<DisabledCommandConfig> {
    constructor() {
        super(DisabledCommandConfig);
    }

    async isCommandDisabled(guildId: string, commandName: string): Promise<boolean> {
        return !!(await this.getOne({guildId, commandName}));
    }

    async getById(id: string): Promise<DisabledCommandConfig | undefined> {
        const result = await this.getOne({ id });
        return result === null ? undefined : result;
    }
}