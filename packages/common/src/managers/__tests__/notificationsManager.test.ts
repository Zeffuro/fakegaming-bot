import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsManager } from '../notificationsManager.js';

vi.mock('../models/notification.js', () => ({
    Notification: {
        findOne: vi.fn(),
        findAll: vi.fn(),
        findOrCreate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    }
}));

describe('NotificationsManager', () => {
    let manager: NotificationsManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new NotificationsManager();
    });

    describe('has', () => {
        it('should check if notification exists', async () => {
            vi.spyOn(manager, 'exists').mockResolvedValue(true);
            const result = await manager.has('youtube', 'video123');
            expect(result).toBe(true);
            expect(manager.exists).toHaveBeenCalledWith({ provider: 'youtube', eventId: 'video123' });
        });
    });

    describe('hasForGuild', () => {
        it('should check if notification exists for specific guild', async () => {
            vi.spyOn(manager, 'exists').mockResolvedValue(false);
            const result = await manager.hasForGuild('twitch', 'stream456', 'guild789');
            expect(result).toBe(false);
            expect(manager.exists).toHaveBeenCalledWith({ provider: 'twitch', eventId: 'stream456', guildId: 'guild789' });
        });
    });

    describe('recordIfNew', () => {
        it('should create new notification if not exists', async () => {
            const mockRecord = { id: 1, provider: 'youtube', eventId: 'vid1' };
            vi.spyOn(manager, 'findOrCreate').mockResolvedValue([mockRecord as any, true]);

            const result = await manager.recordIfNew({ provider: 'youtube', eventId: 'vid1', guildId: 'g1' });

            expect(result.created).toBe(true);
            expect(result.record).toEqual(mockRecord);
        });

        it('should return existing notification if already exists', async () => {
            const mockRecord = { id: 1, provider: 'youtube', eventId: 'vid1' };
            vi.spyOn(manager, 'findOrCreate').mockResolvedValue([mockRecord as any, false]);

            const result = await manager.recordIfNew({ provider: 'youtube', eventId: 'vid1' });

            expect(result.created).toBe(false);
        });
    });

    describe('setMessageMeta', () => {
        it('should update existing notification', async () => {
            vi.spyOn(manager, 'updatePlain').mockResolvedValue([1, []] as [number, any[]]);

            await manager.setMessageMeta('youtube', 'vid1', { messageId: 'msg1', guildId: 'g1' });

            expect(manager.updatePlain).toHaveBeenCalled();
        });

        it('should create notification if update returns 0', async () => {
            vi.spyOn(manager, 'updatePlain').mockResolvedValue([0, []] as [number, any[]]);
            vi.spyOn(manager, 'addPlain').mockResolvedValue({} as any);

            await manager.setMessageMeta('youtube', 'vid1', { messageId: 'msg1' });

            expect(manager.addPlain).toHaveBeenCalled();
        });
    });
});