import {BaseManager} from './baseManager.js';
import {DisabledCommandConfig} from '../models/disabled-command-config.js';

/**
 * Manages disabled commands for guilds.
 */
export class DisabledCommandManager extends BaseManager<DisabledCommandConfig> {
    constructor() {
        super(DisabledCommandConfig);
    }

    /**
     * Checks if a command is disabled in a guild.
     * @param guildId Guild ID.
     * @param commandName Command name.
     * @returns Promise resolving to true if disabled, false otherwise.
     */
    async isCommandDisabled(guildId: string, commandName: string): Promise<boolean> {
        return !!(await this.getOne({guildId, commandName}));
    }

    /**
     * Gets a disabled command config by its primary key id.
     */
    async getById(id: string): Promise<DisabledCommandConfig | undefined> {
        const result = await this.getOne({ id });
        return result === null ? undefined : result;
    }
}