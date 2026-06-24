import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { QuoteOfDayConfig } from '../quote-of-day-config.js';

describe('QuoteOfDayConfig Model', () => {
    beforeEach(async () => {
        await configManager.quoteOfDayManager.removeAll();
    });

    it('creates quote-of-the-day settings with defaults', async () => {
        const config = await QuoteOfDayConfig.create({
            guildId: 'guild-1',
            channelId: 'channel-1',
        });

        expect(config.guildId).toBe('guild-1');
        expect(config.channelId).toBe('channel-1');
        expect(config.enabled).toBe(false);
        expect(config.runHourUtc).toBe(9);
    });
});
