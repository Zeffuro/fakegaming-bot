import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsManager } from '@zeffuro/fakegaming-common/managers';
import { Notification } from '@zeffuro/fakegaming-common/models';
import { hasRecordedJobNotification, sendJobNotification } from '../jobNotifications.js';
import { sendChannelMessagePayloadResult } from '../../utils/discord.js';

vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayloadResult: vi.fn() }));

const entry = { provider: 'youtube', eventId: 'delivery-test', guildId: 'delivery-guild', channelId: 'delivery-channel' };
const payload = { content: 'video' };

function send(manager = new NotificationsManager()) {
    return sendJobNotification({ manager, ...entry, payload });
}

async function receipt() {
    return Notification.findOne({ where: { provider: entry.provider, eventId: entry.eventId, scopeKey: entry.guildId } });
}

beforeEach(async () => {
    await Notification.destroy({ where: { eventId: entry.eventId } });
    vi.mocked(sendChannelMessagePayloadResult).mockResolvedValue({ status: 'sent', message: { id: 'discord-id' } });
});

describe('durable job notification delivery', () => {
    it('allows delivery when a rejected claim was released between the existence and status lookups', async () => {
        const manager = new NotificationsManager();
        await manager.claimDelivery(entry);
        const has = manager.hasForGuild.bind(manager);
        vi.spyOn(manager, 'hasForGuild').mockImplementationOnce(async (...args) => {
            const present = await has(...args);
            await manager.releaseDelivery(...args);
            return present;
        });
        await expect(hasRecordedJobNotification(manager, entry.provider, entry.eventId, entry.guildId)).resolves.toBe(false);
        await expect(send(manager)).resolves.toBe(true);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledOnce();
        expect((await receipt())?.deliveryStatus).toBe('sent');
    });

    it('claims before sending and allows only one overlapping sender', async () => {
        let complete!: (value: { status: 'sent'; message: { id: string } }) => void;
        let started!: () => void;
        const sending = new Promise<void>(resolve => { started = resolve; });
        vi.mocked(sendChannelMessagePayloadResult).mockImplementationOnce(async () => {
            expect((await receipt())?.deliveryStatus).toBe('sending');
            started();
            return new Promise(resolve => { complete = resolve; });
        });
        const first = send();
        await sending;
        await expect(send()).rejects.toThrow('Notification delivery is still pending');
        complete({ status: 'sent', message: { id: 'discord-id' } });
        await expect(first).resolves.toBe(true);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledExactlyOnceWith(entry.channelId, payload);
        expect((await receipt())?.toJSON()).toMatchObject({ deliveryStatus: 'sent', messageId: 'discord-id' });
    });

    it('suppresses an interrupted claim after constructing a fresh manager', async () => {
        await new NotificationsManager().claimDelivery(entry);
        await expect(send()).rejects.toThrow('Notification delivery is still pending');
        expect(sendChannelMessagePayloadResult).not.toHaveBeenCalled();
        expect((await receipt())?.deliveryStatus).toBe('sending');
    });

    it('releases a definitive rejection so a later attempt can succeed', async () => {
        vi.mocked(sendChannelMessagePayloadResult).mockResolvedValueOnce({ status: 'rejected' });
        await expect(send()).rejects.toThrow('Discord rejected notification delivery');
        expect(await receipt()).toBeNull();
        await expect(send()).resolves.toBe(true);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledTimes(2);
    });

    it('retains an unknown outcome across manager restart', async () => {
        vi.mocked(sendChannelMessagePayloadResult).mockResolvedValueOnce({ status: 'unknown' });
        await expect(send()).resolves.toBe(false);
        expect((await receipt())?.deliveryStatus).toBe('uncertain');
        await expect(send()).resolves.toBe(false);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledOnce();
    });

    it('retains a successful response without a message ID as uncertain', async () => {
        vi.mocked(sendChannelMessagePayloadResult).mockResolvedValueOnce({ status: 'sent', message: {} });
        await expect(send()).resolves.toBe(false);
        expect((await receipt())?.deliveryStatus).toBe('uncertain');
        await expect(send()).resolves.toBe(false);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledOnce();
    });

    it('retains an exception as uncertain and propagates the error', async () => {
        vi.mocked(sendChannelMessagePayloadResult).mockRejectedValueOnce(new Error('connection lost'));
        await expect(send()).rejects.toThrow('connection lost');
        expect((await receipt())?.deliveryStatus).toBe('uncertain');
        await expect(send()).resolves.toBe(false);
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledOnce();
    });

    it('keeps the durable claim if saving the successful result fails', async () => {
        const manager = new NotificationsManager();
        vi.spyOn(manager, 'finishDelivery').mockRejectedValueOnce(new Error('database unavailable'));
        await expect(send(manager)).rejects.toThrow('database unavailable');
        expect((await receipt())?.deliveryStatus).toBe('sending');
        await expect(send()).rejects.toThrow('Notification delivery is still pending');
        expect(sendChannelMessagePayloadResult).toHaveBeenCalledOnce();
    });

    it('keeps pending preflight checks retryable and settles interrupted expired claims as uncertain', async () => {
        const manager = new NotificationsManager();
        await manager.claimDelivery(entry);
        await expect(hasRecordedJobNotification(manager, entry.provider, entry.eventId, entry.guildId)).rejects.toThrow('Notification delivery is still pending');
        await Notification.update({ createdAt: new Date(Date.now() - 60_000), updatedAt: new Date(Date.now() - 60_000) }, { where: { eventId: entry.eventId }, silent: true });
        await expect(hasRecordedJobNotification(new NotificationsManager(), entry.provider, entry.eventId, entry.guildId)).resolves.toBe(true);
        expect((await receipt())?.deliveryStatus).toBe('uncertain');
        await expect(send()).resolves.toBe(false);
        expect(sendChannelMessagePayloadResult).not.toHaveBeenCalled();
    });
});
