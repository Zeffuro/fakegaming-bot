import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { UserDigestSubscriptionConfig } from '../user-digest-subscription-config.js';

describe('UserDigestSubscriptionConfig Model', () => {
    beforeEach(async () => {
        await configManager.userDigestSubscriptionManager.removeAll();
    });

    it('creates a personal digest subscription with required fields', async () => {
        const subscription = await UserDigestSubscriptionConfig.create({
            id: 'digest-1',
            discordId: 'user-1',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            categories: '["reminders"]',
            nextRunAt: 1_000,
        });

        expect(subscription.id).toBe('digest-1');
        expect(subscription.discordId).toBe('user-1');
        expect(subscription.frequency).toBe('daily');
        expect(subscription.paused).toBe(false);
        expect(subscription.nextRunAt).toBeTypeOf('number');
    });
});
