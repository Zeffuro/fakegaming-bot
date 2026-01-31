import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TikTokManager } from '../tiktokManager.js';

vi.mock('../models/tiktok-stream-config.js', () => ({
    TikTokStreamConfig: {
        findOne: vi.fn(),
        findAll: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        destroy: vi.fn(),
        upsert: vi.fn(),
    }
}));

describe('TikTokManager', () => {
    let manager: TikTokManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new TikTokManager();
    });

    describe('getAllStreams', () => {
        it('should return all stream configurations', async () => {
            const mockStreams = [{ id: 1 }, { id: 2 }];
            vi.spyOn(manager['model'], 'findAll').mockResolvedValue(mockStreams as any);

            const result = await manager.getAllStreams();

            expect(result).toEqual(mockStreams);
        });
    });

    describe('streamExists', () => {
        it('should return true if stream exists', async () => {
            vi.spyOn(manager, 'getOne').mockResolvedValue({ id: 1 } as any);

            const result = await manager.streamExists('user1', 'channel1', 'guild1');

            expect(result).toBe(true);
        });

        it('should return false if stream does not exist', async () => {
            vi.spyOn(manager, 'getOne').mockResolvedValue(null);

            const result = await manager.streamExists('user1', 'channel1', 'guild1');

            expect(result).toBe(false);
        });
    });

    describe('upsertStream', () => {
        it('should upsert and return stream config', async () => {
            vi.spyOn(manager, 'upsert').mockResolvedValue(true);
            vi.spyOn(manager, 'getOne').mockResolvedValue({ id: 1, tiktokUsername: 'user1' } as any);

            const result = await manager.upsertStream({
                tiktokUsername: 'user1',
                discordChannelId: 'ch1',
                guildId: 'g1'
            });

            expect(result.record).toBeDefined();
            expect(result.created).toBe(true);
        });
    });

    describe('removeStream', () => {
        it('should remove stream configuration', async () => {
            vi.spyOn(manager, 'remove').mockResolvedValue(1 as any);

            await manager.removeStream('user1', 'channel1', 'guild1');

            expect(manager.remove).toHaveBeenCalledWith({
                tiktokUsername: 'user1',
                discordChannelId: 'channel1',
                guildId: 'guild1'
            });
        });
    });
});