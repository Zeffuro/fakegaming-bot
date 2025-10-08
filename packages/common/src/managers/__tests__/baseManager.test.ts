import { describe, it, expect, beforeEach } from 'vitest';
import { BirthdayConfig } from '../../models/birthday-config.js';
import { configManager } from '../../vitest.setup.js';

describe('BirthdayManager', () => {
    const manager = configManager.birthdayManager;

    beforeEach(async () => {
        // Clear DB before each test
        await manager.removeAll();
    });

    it('upsert creates a new record if not exists', async () => {
        await manager.upsert(
            {
                userId: 'user1',
                day: 1,
                month: 1,
                guildId: 'guild1',
                channelId: 'channel1',
            },
            ['userId', 'guildId']
        );

        const record = await manager.getOne({ userId: 'user1' });
        expect(record).not.toBeNull();
        expect(record?.userId).toBe('user1');
    });

    it('upsert updates existing record', async () => {
        await BirthdayConfig.create({
            userId: 'user2',
            day: 2,
            month: 2,
            guildId: 'guild1',
            channelId: 'channel-old',
        });

        const updated = await manager.upsert({
            userId: 'user2',
            day: 2,
            month: 2,
            guildId: 'guild1',
            channelId: 'channel-new',
        });

        expect(updated).toBe(false);

        const record = await manager.getOne({ userId: 'user2' });
        expect(record?.channelId).toBe('channel-new');
    });

    it('getOne returns the correct record', async () => {
        await BirthdayConfig.create({
            userId: 'user3',
            day: 3,
            month: 3,
            guildId: 'guild1',
            channelId: 'channel1',
        });

        const record = await manager.getOne({ userId: 'user3' });
        expect(record?.userId).toBe('user3');
    });

    it('exists returns true if record exists', async () => {
        await BirthdayConfig.create({
            userId: 'user4',
            day: 4,
            month: 4,
            guildId: 'guild1',
            channelId: 'channel1',
        });

        const exists = await manager.exists({ userId: 'user4' });
        expect(exists).toBe(true);
    });

    it('removeByPk deletes the record', async () => {
        await BirthdayConfig.create({
            userId: 'user5',
            day: 5,
            month: 5,
            guildId: 'guild1',
            channelId: 'channel1',
        });

        await manager.removeByPk('user5');

        const record = await manager.getOne({ userId: 'user5' });
        expect(record).toBeNull();
    });

    it('getAndCountAll returns count correctly', async () => {
        await BirthdayConfig.create({
            userId: 'user6',
            day: 6,
            month: 6,
            guildId: 'guild1',
            channelId: 'channel1',
        });

        const result = await manager.getAndCountAll();
        expect(result.count).toBe(1);
        expect(result.rows[0].userId).toBe('user6');
    });
});
