import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { BirthdayConfig } from '../birthday-config.js';

describe('BirthdayConfig Model', () => {
    beforeEach(async () => {
        await configManager.birthdayManager.remove({});
    });

    it('should create a birthday with all required fields', async () => {
        const birthday = await BirthdayConfig.create({
            userId: 'user-123',
            day: 15,
            month: 6,
            guildId: 'guild-456',
            channelId: 'channel-789',
        });

        expect(birthday.userId).toBe('user-123');
        expect(birthday.day).toBe(15);
        expect(birthday.month).toBe(6);
        expect(birthday.guildId).toBe('guild-456');
        expect(birthday.channelId).toBe('channel-789');
        expect(birthday.year).toBeUndefined();
    });

    it('should create a birthday with optional year', async () => {
        const birthday = await BirthdayConfig.create({
            userId: 'user-456',
            day: 25,
            month: 12,
            year: 1990,
            guildId: 'guild-789',
            channelId: 'channel-101',
        });

        expect(birthday.year).toBe(1990);
    });

    it('should find birthdays by guildId', async () => {
        await BirthdayConfig.create({
            userId: 'user-1',
            day: 1,
            month: 1,
            guildId: 'test-guild',
            channelId: 'channel-1',
        });

        await BirthdayConfig.create({
            userId: 'user-2',
            day: 2,
            month: 2,
            guildId: 'test-guild',
            channelId: 'channel-1',
        });

        const birthdays = await BirthdayConfig.findAll({
            where: { guildId: 'test-guild' },
        });

        expect(birthdays).toHaveLength(2);
        expect(birthdays.every(b => b.guildId === 'test-guild')).toBe(true);
    });

    it('should update birthday information', async () => {
        const birthday = await BirthdayConfig.create({
            userId: 'user-update',
            day: 10,
            month: 5,
            guildId: 'guild-update',
            channelId: 'channel-old',
        });

        birthday.channelId = 'channel-new';
        birthday.year = 1995;
        await birthday.save();

        const updated = await BirthdayConfig.findByPk('user-update');
        expect(updated?.channelId).toBe('channel-new');
        expect(updated?.year).toBe(1995);
    });

    it('should delete a birthday', async () => {
        const birthday = await BirthdayConfig.create({
            userId: 'user-delete',
            day: 20,
            month: 8,
            guildId: 'guild-delete',
            channelId: 'channel-delete',
        });

        await birthday.destroy();

        const deleted = await BirthdayConfig.findByPk('user-delete');
        expect(deleted).toBeNull();
    });

    it('should enforce unique userId', async () => {
        await BirthdayConfig.create({
            userId: 'unique-user',
            day: 15,
            month: 3,
            guildId: 'guild-1',
            channelId: 'channel-1',
        });

        await expect(
            BirthdayConfig.create({
                userId: 'unique-user',
                day: 20,
                month: 4,
                guildId: 'guild-2',
                channelId: 'channel-2',
            })
        ).rejects.toThrow();
    });
});

