import { beforeEach, describe, expect, it } from 'vitest';
import { PersonalNotificationHistory } from '../../models/personal-notification-history.js';
import { PersonalNotificationHistoryManager, type NotificationHistoryInput } from '../personalNotificationHistoryManager.js';
import { serializedTransaction } from '../serializedTransaction.js';

const now = Date.parse('2026-10-11T10:00Z');
const manager = new PersonalNotificationHistoryManager(() => now);
const input = (override: Partial<NotificationHistoryInput> = {}): NotificationHistoryInput => ({ userId: 'owner', kind: 'reminder',
    occurrenceKey: 'logical-one', title: 'Buy melk @everyone', scheduledAt: now - 60_000, observedAt: now, status: 'delayed', reason: 'paused', ...override });
beforeEach(async () => { await PersonalNotificationHistory.destroy({ where: {} }); });

describe('bounded private notification history', () => {
    it('updates a stable logical occurrence across pause, retries and sends without returning private keys or owners', async () => {
        await manager.record(input()); await manager.record(input({ observedAt: now + 1, scheduledAt: now + 60_000, status: 'failed', reason: 'retry' }));
        await manager.record(input({ observedAt: now + 2, status: 'sent', reason: null, messageId: '123456789012345678', channelId: '987654321012345678' }));
        const page = await manager.list('owner');
        expect(page).toMatchObject({ total: 1, offset: 0, limit: 20, retentionDays: 90 });
        expect(page.items[0]).toMatchObject({ title: 'Buy melk @everyone', status: 'sent', reason: null, scheduledAt: now - 60_000, updatedAt: now + 2,
            sentAt: now + 2, messageUrl: 'https://discord.com/channels/@me/987654321012345678/123456789012345678' });
        expect(page.items[0]).not.toHaveProperty('userId'); expect(page.items[0]).not.toHaveProperty('occurrenceKey');
        expect((await manager.list('other')).total).toBe(0);
    });

    it.each(['sent', 'uncertain'] as const)('preserves %s against stale and later conflicting workers, including independent manager races', async status => {
        await manager.record(input({ status, reason: status === 'uncertain' ? 'unknown' : null }));
        await Promise.all([manager.record(input({ status: 'delayed', observedAt: now + 10 })),
            new PersonalNotificationHistoryManager(() => now).record(input({ status: 'failed', reason: 'retry', observedAt: now - 10 }))]);
        expect((await manager.list('owner')).items[0]?.status).toBe(status);
        expect(await PersonalNotificationHistory.count()).toBe(1);
    });

    it('deduplicates concurrent first writers and rejects older observations without poll-cycle ordering churn', async () => {
        await Promise.all([manager.record(input()), manager.record(input())]);
        await manager.record(input({ observedAt: now + 60_000 }));
        expect(Number((await PersonalNotificationHistory.findOne())?.updatedAt)).toBe(now);
        await manager.record(input({ status: 'failed', reason: 'retry', observedAt: now - 1 }));
        expect((await manager.list('owner')).items[0]?.status).toBe('delayed');
        await manager.record(input({ status: 'sent', reason: null, observedAt: now - 1 }));
        expect((await manager.list('owner')).items[0]).toMatchObject({ status: 'sent', updatedAt: now, sentAt: now - 1 });
    });

    it('always filters owner and retention, pages equal timestamps deterministically and separates kind/status', async () => {
        for (const [id, kind, status] of [['one', 'reminder', 'delayed'], ['two', 'anime', 'sent'], ['three', 'anime', 'sent']] as const) {
            await manager.record(input({ occurrenceKey: id, kind, status }));
        }
        await manager.record(input({ userId: 'other', kind: 'anime', status: 'sent' }));
        const all = await manager.list('owner');
        expect((await manager.list('owner', { limit: 1, offset: 1 })).items).toEqual([all.items[1]]);
        expect((await manager.list('owner', { kind: 'anime', status: 'sent' })).total).toBe(2);
        await PersonalNotificationHistory.update({ updatedAt: now - 91 * 86_400_000 }, { where: { userId: 'owner', occurrenceKey: 'one' } });
        expect((await manager.list('owner')).total).toBe(2);
    });

    it('bounds storage to 1000 rows per owner and prunes expired rows on writes', async () => {
        const rows = Array.from({ length: 1000 }, (_, index) => ({ id: `seed-${index}`, userId: 'owner', kind: 'reminder', occurrenceKey: `seed-${index}`,
            status: 'sent', reason: null, title: 'Saved', scheduledAt: now - 60_000, updatedAt: now - index, sentAt: now - index, messageId: null, channelId: null }));
        await PersonalNotificationHistory.bulkCreate([...rows, { ...rows[0]!, id: 'expired', occurrenceKey: 'expired', updatedAt: now - 91 * 86_400_000 }]);
        await manager.record(input({ observedAt: now + 1 }));
        expect(await PersonalNotificationHistory.count({ where: { userId: 'owner' } })).toBe(1000);
        expect(await PersonalNotificationHistory.findByPk('expired')).toBeNull();
        expect((await manager.list('owner', { limit: 1 })).items[0]?.status).toBe('delayed');
    });

    it('participates in an explicit transaction and rolls back cleanly', async () => {
        await expect(serializedTransaction(PersonalNotificationHistory.sequelize!, async transaction => {
            await manager.record(input({ transaction })); throw new Error('rollback');
        })).rejects.toThrow('rollback');
        expect(await PersonalNotificationHistory.count()).toBe(0);
    });

    it('accepts only safe summary values and builds no arbitrary or invalid message links', async () => {
        for (const bad of [{ userId: '' }, { title: 'x'.repeat(201) }, { occurrenceKey: 'x'.repeat(257) }, { scheduledAt: NaN },
            { observedAt: -1 }, { sentAt: Infinity }, { kind: 'public' }, { reason: 'raw-error' }]) {
            await expect(manager.record(input(bad as Partial<NotificationHistoryInput>))).rejects.toThrow('Invalid notification history');
        }
        await manager.record(input({ status: 'sent', messageId: 'https://example.com', channelId: '../escape' }));
        expect((await manager.list('owner')).items[0]?.messageUrl).toBeNull();
        await manager.record(input({ occurrenceKey: 'invalid-snowflake', status: 'sent', messageId: '99999999999999999999', channelId: '123456789012345678' }));
        expect((await manager.list('owner')).items.every(row => row.messageUrl === null)).toBe(true);
        await expect(manager.list('owner', { limit: 101 })).rejects.toThrow();
        await expect(manager.list('owner', { offset: -1 })).rejects.toThrow();
        await expect(manager.list('owner', { status: 'public' as never })).rejects.toThrow();
    });
});
