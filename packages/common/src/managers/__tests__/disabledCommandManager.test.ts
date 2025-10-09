import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { DisabledCommandConfig } from '../../models/disabled-command-config.js';

describe('DisabledCommandManager', () => {
    const disabledCommandManager = configManager.disabledCommandManager;

    beforeEach(async () => {
        await disabledCommandManager.removeAll();
    });

    describe('isCommandDisabled', () => {
        it('should return true if command is disabled', async () => {
            await DisabledCommandConfig.create({
                guildId: 'guild-1',
                commandName: 'testcommand',
            });

            const result = await disabledCommandManager.isCommandDisabled('guild-1', 'testcommand');
            expect(result).toBe(true);
        });

        it('should return false if command is not disabled', async () => {
            const result = await disabledCommandManager.isCommandDisabled('guild-1', 'testcommand');
            expect(result).toBe(false);
        });

        it('should be guild-specific', async () => {
            await DisabledCommandConfig.create({
                guildId: 'guild-1',
                commandName: 'testcommand',
            });

            const resultGuild1 = await disabledCommandManager.isCommandDisabled('guild-1', 'testcommand');
            const resultGuild2 = await disabledCommandManager.isCommandDisabled('guild-2', 'testcommand');

            expect(resultGuild1).toBe(true);
            expect(resultGuild2).toBe(false);
        });
    });
});

