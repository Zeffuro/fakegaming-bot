import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { BirthdayConfig } from '../../models/birthday-config.js';

describe('BirthdayManager', () => {
    const birthdayManager = configManager.birthdayManager;

    beforeEach(async () => {
        await birthdayManager.remove({});
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

            const result = await birthdayManager.hasBirthday({
                userId: 'user-1',
                guildId: 'guild-1',
            });

            expect(result).toBe(true);
        });

        it('should return false if birthday does not exist', async () => {
            const result = await birthdayManager.hasBirthday({
                userId: 'non-existent',
                guildId: 'guild-1',
            });

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

            const result = await birthdayManager.getBirthday({
                userId: 'user-1',
                guildId: 'guild-1',
            });

            expect(result).not.toBeNull();
            expect(result?.userId).toBe('user-1');
            expect(result?.day).toBe(15);
            expect(result?.month).toBe(6);
        });

        it('should return null if birthday not found', async () => {
            const result = await birthdayManager.getBirthday({
                userId: 'non-existent',
                guildId: 'guild-1',
            });

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

            await birthdayManager.removeBirthday({
                userId: 'user-1',
                guildId: 'guild-1',
            });

            const result = await birthdayManager.getBirthday({
                userId: 'user-1',
                guildId: 'guild-1',
            });

            expect(result).toBeNull();
        });
    });
});
