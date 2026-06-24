import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';

describe('UserDigestSubscriptionManager', () => {
    const manager = configManager.userDigestSubscriptionManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('creates and updates one digest subscription per user', async () => {
        const created = await manager.upsertForUser({
            discordId: 'digest-user',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            categories: ['reminders'],
            nextRunAt: Date.parse('2026-06-23T09:00:00.000Z'),
        });

        expect(created).toMatchObject({
            discordId: 'digest-user',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            paused: false,
        });

        const updated = await manager.upsertForUser({
            discordId: 'digest-user',
            frequency: 'weekly',
            timezone: 'Europe/Amsterdam',
            runAt: '08:30',
            dayOfWeek: 1,
            paused: true,
            nextRunAt: Date.parse('2026-06-29T06:30:00.000Z'),
        });

        expect(updated.id).toBe(created.id);
        expect(updated).toMatchObject({
            frequency: 'weekly',
            timezone: 'Europe/Amsterdam',
            runAt: '08:30',
            dayOfWeek: 1,
        });
        expect(Boolean(updated.paused)).toBe(true);
    });

    it('lists due active subscriptions and records runs', async () => {
        await manager.upsertForUser({
            discordId: 'due-user',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            nextRunAt: 1_000,
        });
        await manager.upsertForUser({
            discordId: 'future-user',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            nextRunAt: 10_000,
        });
        await manager.upsertForUser({
            discordId: 'paused-user',
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:00',
            paused: true,
            nextRunAt: 1_000,
        });

        const due = await manager.listDue(5_000);
        expect(due.map((subscription) => subscription.discordId)).toEqual(['due-user']);

        await manager.markRun(due[0].id, {
            lastRunAt: 5_000,
            lastSentAt: 5_000,
            nextRunAt: 100_000,
        });
        const updated = await manager.getForUser('due-user');
        expect(updated).toMatchObject({
            lastRunAt: 5_000,
            lastSentAt: 5_000,
            nextRunAt: 100_000,
        });
    });
});
