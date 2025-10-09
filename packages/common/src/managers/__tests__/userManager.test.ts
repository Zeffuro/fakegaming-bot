import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { UserConfig } from '../../models/user-config.js';
import { LeagueConfig } from '../../models/league-config.js';

describe('UserManager', () => {
    const userManager = configManager.userManager;

    beforeEach(async () => {
        await userManager.removeAll();
        await LeagueConfig.destroy({ where: {} });
    });

    describe('getUser', () => {
        it('should return user by discordId', async () => {
            await UserConfig.create({
                discordId: 'user-1',
                timezone: 'America/New_York',
            });

            const result = await userManager.getUser({ discordId: 'user-1' });

            expect(result).not.toBeNull();
            expect(result?.discordId).toBe('user-1');
        });

        it('should return null if user not found', async () => {
            const result = await userManager.getUser({ discordId: 'nonexistent' });
            expect(result).toBeNull();
        });
    });

    describe('getUserWithLeague', () => {
        it('should return user with league data', async () => {
            await UserConfig.create({
                discordId: 'user-with-league',
                timezone: 'America/New_York',
            });

            await LeagueConfig.create({
                discordId: 'user-with-league',
                summonerName: 'TestSummoner',
                region: 'NA',
                puuid: 'test-puuid',
            });

            const result = await userManager.getUserWithLeague('user-with-league');

            expect(result).not.toBeNull();
            expect(result?.discordId).toBe('user-with-league');
        });

        it('should return null if user not found', async () => {
            const result = await userManager.getUserWithLeague('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('setUser', () => {
        it('should create or update user', async () => {
            await userManager.setUser({
                discordId: 'user-set',
                timezone: 'America/Los_Angeles',
            });

            const result = await userManager.getUser({ discordId: 'user-set' });
            expect(result).not.toBeNull();
            expect(result?.timezone).toBe('America/Los_Angeles');
        });

        it('should update existing user', async () => {
            await UserConfig.create({
                discordId: 'user-update',
                timezone: 'America/New_York',
            });

            await userManager.setUser({
                discordId: 'user-update',
                timezone: 'America/Chicago',
            });

            const result = await userManager.getUser({ discordId: 'user-update' });
            expect(result?.timezone).toBe('America/Chicago');
        });
    });

    describe('setTimezone', () => {
        it('should set user timezone', async () => {
            await UserConfig.create({
                discordId: 'user-tz',
                timezone: 'UTC',
            });

            await userManager.setTimezone({
                discordId: 'user-tz',
                timezone: 'America/Denver',
            });

            const result = await userManager.getUser({ discordId: 'user-tz' });
            expect(result?.timezone).toBe('America/Denver');
        });
    });

    describe('setDefaultReminderTimeSpan', () => {
        it('should set user default reminder timespan', async () => {
            await UserConfig.create({
                discordId: 'user-reminder',
                timezone: 'UTC',
            });

            await userManager.setDefaultReminderTimeSpan({
                discordId: 'user-reminder',
                timespan: '1h',
            });

            const result = await userManager.getUser({ discordId: 'user-reminder' });
            expect(result?.defaultReminderTimeSpan).toBe('1h');
        });
    });
});
