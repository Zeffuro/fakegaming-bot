import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { Notification } from '../../models/notification.js';
import { NotificationsManager } from '../notificationsManager.js';

describe('NotificationsManager', () => {
    const manager = configManager.notificationsManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('checks notification existence globally and by guild', async () => {
        await manager.recordIfNew({
            provider: 'youtube',
            eventId: 'video-1',
            guildId: 'guild-1',
        });

        await expect(manager.has('youtube', 'video-1')).resolves.toBe(true);
        await expect(manager.has('youtube', 'missing')).resolves.toBe(false);
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-1')).resolves.toBe(true);
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-2')).resolves.toBe(false);
    });

    it('records a provider event independently per guild and only once in each guild', async () => {
        const first = await manager.recordIfNew({
            provider: 'twitch',
            eventId: 'stream-1',
            guildId: 'guild-1',
        });
        const second = await manager.recordIfNew({
            provider: 'twitch',
            eventId: 'stream-1',
            guildId: 'guild-2',
        });

        expect(first.created).toBe(true);
        const repeated = await manager.recordIfNew({ provider: 'twitch', eventId: 'stream-1', guildId: 'guild-2' });
        expect(second.created).toBe(true);
        expect(second.record.id).not.toBe(first.record.id);
        expect(repeated.created).toBe(false);
        expect(repeated.record.id).toBe(second.record.id);
        await expect(manager.hasForGuild('twitch', 'stream-1', 'guild-1')).resolves.toBe(true);
        await expect(manager.hasForGuild('twitch', 'stream-1', 'guild-2')).resolves.toBe(true);
    });

    it('keeps null and absent guilds in one global scope independently from guild receipts', async () => {
        const first = await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1' });
        const second = await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1', guildId: null });
        const guild = await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' });
        expect(first.created).toBe(true);
        expect(second.created).toBe(false);
        expect(second.record.id).toBe(first.record.id);
        expect(first.record.scopeKey).toBe('');
        expect(guild.created).toBe(true);
        expect(guild.record.deliveryStatus).toBe('sent');
        expect(await Notification.count()).toBe(2);
    });

    it('allows exactly one concurrent claimant per guild across independent managers', async () => {
        const entry = { provider: 'youtube', eventId: 'video-1', guildId: 'guild-1', channelId: 'channel-1' };
        const claims = await Promise.all([manager.claimDelivery(entry), new NotificationsManager().claimDelivery(entry), manager.claimDelivery(entry)]);
        expect(claims.filter(Boolean)).toHaveLength(1);
        await expect(manager.claimDelivery({ ...entry, guildId: 'guild-2' })).resolves.toBe(true);
        expect(await Notification.count()).toBe(2);
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-1')).resolves.toBe(true);
        await expect(new NotificationsManager().claimDelivery(entry)).resolves.toBe(false);
    });

    it('settles only the sending guild receipt and protects confirmed or uncertain deliveries from release or stale settlement', async () => {
        const entry = { provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' };
        await manager.claimDelivery(entry);
        await manager.claimDelivery({ ...entry, guildId: 'guild-2' });
        await manager.finishDelivery('youtube', 'video-1', 'guild-1', { status: 'sent', messageId: 'message-1' });
        await manager.finishDelivery('youtube', 'video-1', 'guild-2', { status: 'uncertain' });
        await manager.releaseDelivery('youtube', 'video-1', 'guild-1');
        await manager.releaseDelivery('youtube', 'video-1', 'guild-2');
        await manager.finishDelivery('youtube', 'video-1', 'guild-1', { status: 'uncertain', messageId: 'wrong' });
        expect(await Notification.findAll({ raw: true })).toEqual(expect.arrayContaining([
            expect.objectContaining({ guildId: 'guild-1', deliveryStatus: 'sent', messageId: 'message-1' }),
            expect.objectContaining({ guildId: 'guild-2', deliveryStatus: 'uncertain' }),
        ]));
        await expect(new NotificationsManager().claimDelivery(entry)).resolves.toBe(false);
        await expect(manager.claimDelivery({ ...entry, guildId: 'guild-2' })).resolves.toBe(false);
    });

    it('releases only a definitively rejected sending scope so it can be retried', async () => {
        await manager.claimDelivery({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' });
        await manager.claimDelivery({ provider: 'youtube', eventId: 'video-1' });
        await manager.releaseDelivery('youtube', 'video-1', 'guild-1');
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-1')).resolves.toBe(false);
        await expect(manager.has('youtube', 'video-1')).resolves.toBe(true);
        await expect(manager.claimDelivery({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' })).resolves.toBe(true);
        await manager.finishDelivery('youtube', 'video-1', undefined, { status: 'sent', messageId: 'global-message' });
        expect((await Notification.findOne({ where: { scopeKey: '' } }))?.messageId).toBe('global-message');
    });

    it('keeps sending and uncertain receipts out of delivered history and analytics while blocking replay', async () => {
        for (const eventId of ['sending', 'uncertain', 'sent']) {
            await manager.claimDelivery({ provider: 'youtube', eventId, guildId: 'guild-1' });
        }
        await manager.finishDelivery('youtube', 'uncertain', 'guild-1', { status: 'uncertain' });
        await manager.finishDelivery('youtube', 'sent', 'guild-1', { status: 'sent' });
        for (const eventId of ['sending', 'uncertain']) {
            await expect(manager.has('youtube', eventId)).resolves.toBe(true);
            await expect(manager.hasForGuild('youtube', eventId, 'guild-1')).resolves.toBe(true);
        }
        const history = await manager.list({ guildId: 'guild-1' });
        expect(history.total).toBe(1);
        expect(history.records.map(record => record.eventId)).toEqual(['sent']);
        expect(history.summary.total).toBe(1);
        expect(history.summary.byProvider).toEqual([{ provider: 'youtube', count: 1 }]);
        expect(history.summary.trend.reduce((sum, point) => sum + point.count, 0)).toBe(1);
        expect((await manager.list()).total).toBe(1);
    });

    it('reports exact delivery scopes and retires expired sending claims without allowing release or replay', async () => {
        const now = new Date('2026-10-11T20:00:00Z');
        const entry = { provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' };
        await manager.claimDelivery(entry);
        await Notification.update({ createdAt: new Date(now.getTime() - 45_000) }, { where: { scopeKey: 'guild-1' }, silent: true });
        await expect(manager.getDeliveryStatus('youtube', 'video-1', 'guild-1', now)).resolves.toBe('sending');
        await expect(manager.getDeliveryStatus('youtube', 'video-1', 'guild-2', now)).resolves.toBeNull();
        await expect(manager.getDeliveryStatus('youtube', 'video-1', undefined, now)).resolves.toBeNull();
        await expect(manager.getDeliveryStatus('youtube', 'video-1', 'guild-1', new Date(now.getTime() + 1))).resolves.toBe('uncertain');
        await manager.finishDelivery('youtube', 'video-1', 'guild-1', { status: 'sent', messageId: 'late-message' });
        await manager.releaseDelivery('youtube', 'video-1', 'guild-1');
        await expect(manager.getDeliveryStatus('youtube', 'video-1', 'guild-1', now)).resolves.toBe('uncertain');
        await expect(new NotificationsManager().claimDelivery(entry)).resolves.toBe(false);
        await expect(manager.hasForGuild('youtube', 'video-1', 'guild-1')).resolves.toBe(true);
        expect((await manager.list()).total).toBe(0);
    });

    it('keeps a confirmed settlement authoritative when expiry recovery races it', async () => {
        const now = new Date('2026-10-11T20:00:00Z');
        await manager.claimDelivery({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' });
        await Notification.update({ createdAt: new Date(now.getTime() - 46_000) }, { where: { scopeKey: 'guild-1' }, silent: true });
        await manager.finishDelivery('youtube', 'video-1', 'guild-1', { status: 'sent', messageId: 'message-1' });
        await expect(manager.getDeliveryStatus('youtube', 'video-1', 'guild-1', now)).resolves.toBe('sent');
        expect((await manager.list()).records[0]?.messageId).toBe('message-1');
    });

    it('upserts message metadata for an existing or new notification', async () => {
        await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' });
        await manager.setMessageMeta('youtube', 'video-1', {
            guildId: 'guild-1',
            channelId: 'channel-1',
            messageId: 'message-1',
        });
        await manager.setMessageMeta('bluesky', 'post-1', {
            guildId: 'guild-2',
            channelId: 'channel-2',
            messageId: 'message-2',
        });

        const result = await manager.list({ limit: 10 });

        expect(result.total).toBe(2);
        expect(result.records).toEqual(expect.arrayContaining([
            expect.objectContaining({
                provider: 'youtube',
                eventId: 'video-1',
                guildId: 'guild-1',
                channelId: 'channel-1',
                messageId: 'message-1',
            }),
            expect.objectContaining({
                provider: 'bluesky',
                eventId: 'post-1',
                guildId: 'guild-2',
                channelId: 'channel-2',
                messageId: 'message-2',
            }),
        ]));
    });

    it('updates metadata in its explicit scope without replacing another guild or a global receipt', async () => {
        for (const guildId of [undefined, 'guild-1', 'guild-2']) {
            await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1', guildId, messageId: guildId ?? 'global' });
        }
        await manager.setMessageMeta('youtube', 'video-1', { guildId: 'guild-2', messageId: 'updated' });
        expect(await Notification.findAll({ raw: true })).toEqual(expect.arrayContaining([
            expect.objectContaining({ scopeKey: '', messageId: 'global' }),
            expect.objectContaining({ scopeKey: 'guild-1', messageId: 'guild-1' }),
            expect.objectContaining({ scopeKey: 'guild-2', messageId: 'updated' }),
        ]));
    });

    it('lists recent notifications with filters, pagination, and provider summary', async () => {
        await manager.recordIfNew({ provider: 'twitch', eventId: 'stream-1', guildId: 'guild-1' });
        await manager.recordIfNew({ provider: 'youtube', eventId: 'video-1', guildId: 'guild-1' });
        await manager.recordIfNew({ provider: 'youtube', eventId: 'video-2', guildId: 'guild-2' });

        const result = await manager.list({ guildId: 'guild-1', limit: 1 });

        expect(result.total).toBe(2);
        expect(result.limit).toBe(1);
        expect(result.records).toHaveLength(1);
        expect(result.records[0]).not.toHaveProperty('scopeKey');
        expect(result.records[0]).not.toHaveProperty('deliveryStatus');
        expect(result.summary).toEqual({
            total: 2,
            byProvider: expect.arrayContaining([
                { provider: 'twitch', count: 1 },
                { provider: 'youtube', count: 1 },
            ]),
            trend: expect.any(Array),
        });
    });

    it('lists birthday deliveries for one user from event ID segments', async () => {
        await manager.recordIfNew({ provider: 'birthday', eventId: 'guild-1:user-1:2026-06-24', guildId: 'guild-1' });
        await manager.recordIfNew({ provider: 'birthday', eventId: 'guild-2:user-2:2026-06-24', guildId: 'guild-2' });
        await manager.recordIfNew({ provider: 'youtube', eventId: 'guild-1:user-1:2026-06-24', guildId: 'guild-1' });

        const result = await manager.listBirthdayDeliveriesForUser({ userId: 'user-1', limit: 10 });

        expect(result.total).toBe(1);
        expect(result.records).toEqual([
            expect.objectContaining({
                provider: 'birthday',
                eventId: 'guild-1:user-1:2026-06-24',
                guildId: 'guild-1',
            }),
        ]);
    });

    it('does not use unsafe user IDs in delivery lookup patterns', async () => {
        await manager.recordIfNew({ provider: 'birthday', eventId: 'guild-1:user-1:2026-06-24', guildId: 'guild-1' });

        const result = await manager.listBirthdayDeliveriesForUser({
            userId: 'user_%',
            limit: 10,
            days: 2,
            now: new Date('2026-06-24T12:00:00.000Z'),
        });

        expect(result).toMatchObject({
            total: 0,
            records: [],
            summary: {
                total: 0,
                byProvider: [],
                trend: [
                    { date: '2026-06-23', count: 0 },
                    { date: '2026-06-24', count: 0 },
                ],
            },
        });
    });

    it('builds a bounded daily trend independent of pagination', async () => {
        await manager.addPlain({
            provider: 'twitch',
            eventId: 'stream-today',
            guildId: 'guild-1',
            createdAt: new Date('2026-06-22T10:30:00.000Z'),
        } as any);
        await manager.addPlain({
            provider: 'youtube',
            eventId: 'video-yesterday',
            guildId: 'guild-1',
            createdAt: new Date('2026-06-21T10:30:00.000Z'),
        } as any);
        await manager.addPlain({
            provider: 'youtube',
            eventId: 'video-other-guild',
            guildId: 'guild-2',
            createdAt: new Date('2026-06-22T10:30:00.000Z'),
        } as any);
        await manager.addPlain({
            provider: 'twitch',
            eventId: 'stream-outside-window',
            guildId: 'guild-1',
            createdAt: new Date('2026-06-10T10:30:00.000Z'),
        } as any);

        const result = await manager.list({
            guildId: 'guild-1',
            limit: 1,
            days: 7,
            now: new Date('2026-06-22T12:00:00.000Z'),
        });

        expect(result.records).toHaveLength(1);
        expect(result.summary.trend).toEqual([
            { date: '2026-06-16', count: 0 },
            { date: '2026-06-17', count: 0 },
            { date: '2026-06-18', count: 0 },
            { date: '2026-06-19', count: 0 },
            { date: '2026-06-20', count: 0 },
            { date: '2026-06-21', count: 1 },
            { date: '2026-06-22', count: 1 },
        ]);
    });
});
