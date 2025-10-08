import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { BirthdayConfig } from '../../models/birthday-config.js';

describe('BirthdayManager', () => {
    const birthdayManager = configManager.birthdayManager;

    beforeEach(async () => {
        await birthdayManager.removeAll();
    });

    describe('hasBirthday', () => {
        it('should return true if birthday exists', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                guildId: 'guild-1',
                day: 15,
                month: 6,
                channelId: 'channel-1',
            });

            const result = await birthdayManager.hasBirthday('user-1', 'guild-1');

            expect(result).toBe(true);
        });

        it('should return false if birthday does not exist', async () => {
            const result = await birthdayManager.hasBirthday('non-existent', 'guild-1');

            expect(result).toBe(false);
        });
    });

    describe('getBirthday', () => {
        it('should return birthday for user in guild', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                guildId: 'guild-1',
                day: 15,
                month: 6,
                channelId: 'channel-1',
            });

            const result = await birthdayManager.getBirthday('user-1', 'guild-1');

            expect(result).not.toBeNull();
            expect(result?.userId).toBe('user-1');
            expect(result?.day).toBe(15);
            expect(result?.month).toBe(6);
        });

        it('should return null if birthday not found', async () => {
            const result = await birthdayManager.getBirthday('non-existent', 'guild-1');

            expect(result).toBeNull();
        });
    });

    describe('removeBirthday', () => {
        it('should remove birthday for user in guild', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                guildId: 'guild-1',
                day: 15,
                month: 6,
                channelId: 'channel-1',
            });

            await birthdayManager.removeBirthday('user-1', 'guild-1');

            const result = await birthdayManager.getBirthday('user-1', 'guild-1');

            expect(result).toBeNull();
        });
    });

    describe('isBirthdayToday', () => {
        it('returns true when today matches day and month', () => {
            const today = new Date('2025-10-08');
            const result = birthdayManager.isBirthdayToday({ day: 8, month: 10 }, today);
            expect(result).toBe(true);
        });

        it('treats Feb 29 as Feb 28 on non-leap years', () => {
            const nonLeap = new Date('2025-02-28'); // 2025 is not a leap year
            const result = birthdayManager.isBirthdayToday({ day: 29, month: 2 }, nonLeap);
            expect(result).toBe(true);
        });
    });
});
