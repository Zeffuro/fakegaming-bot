import { describe, it, expect, beforeEach } from 'vitest';
import { Notification } from '../notification.js';
import { UniqueConstraintError } from 'sequelize';

describe('Notification Model', () => {
    beforeEach(async () => {
        await Notification.destroy({ where: {} });
    });

    it('creates a notification record', async () => {
        const rec = await Notification.create({ provider: 'twitch', eventId: 'evt-1', guildId: 'g1', channelId: 'c1' });
        expect(rec.id).toBeTruthy();
        expect(rec.provider).toBe('twitch');
        expect(rec.eventId).toBe('evt-1');
    });

    it('enforces unique (provider,eventId)', async () => {
        await Notification.create({ provider: 'twitch', eventId: 'dup-1' });
        await expect(Notification.create({ provider: 'twitch', eventId: 'dup-1' })).rejects.toBeInstanceOf(UniqueConstraintError);
    });

    it('allows same eventId for different providers', async () => {
        await Notification.create({ provider: 'twitch', eventId: 'shared' });
        const youtubeRec = await Notification.create({ provider: 'youtube', eventId: 'shared' });
        expect(youtubeRec.id).toBeTruthy();
        expect(youtubeRec.provider).toBe('youtube');
    });
});

