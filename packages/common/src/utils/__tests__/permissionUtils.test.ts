/**
 * Tests for utils/permissionUtils.ts permission checking utilities
 */
import { describe, it, expect } from 'vitest';
import { isGuildAdmin, checkGuildAccess, DISCORD_PERMISSION_ADMINISTRATOR } from '../permissionUtils.js';
import type { MinimalGuildData } from '../../discord/types.js';

describe('permissionUtils', () => {
    describe('isGuildAdmin', () => {
        it('should return false if guildId is undefined', () => {
            const guilds: MinimalGuildData[] = [{ id: '123', owner: false, permissions: '0' }];
            expect(isGuildAdmin(guilds, undefined)).toBe(false);
        });

        it('should return false if guilds is not an array', () => {
            expect(isGuildAdmin(undefined, '123')).toBe(false);
            expect(isGuildAdmin(null as any, '123')).toBe(false);
        });

        it('should return false if guild not found', () => {
            const guilds: MinimalGuildData[] = [{ id: '123', owner: false, permissions: '0' }];
            expect(isGuildAdmin(guilds, '456')).toBe(false);
        });

        it('should return true if user is guild owner', () => {
            const guilds: MinimalGuildData[] = [{ id: '123', owner: true, permissions: '0' }];
            expect(isGuildAdmin(guilds, '123')).toBe(true);
        });

        it('should return true if user has administrator permission', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: false, permissions: String(DISCORD_PERMISSION_ADMINISTRATOR) }
            ];
            expect(isGuildAdmin(guilds, '123')).toBe(true);
        });

        it('should return true if user has administrator permission among other permissions', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: false, permissions: String(0x8 | 0x400) } // Admin + Manage Server
            ];
            expect(isGuildAdmin(guilds, '123')).toBe(true);
        });

        it('should return false if user does not have administrator permission', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: false, permissions: '1024' } // Some other permission
            ];
            expect(isGuildAdmin(guilds, '123')).toBe(false);
        });

        it('should return false if permissions is undefined', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: false, permissions: undefined }
            ];
            expect(isGuildAdmin(guilds, '123')).toBe(false);
        });
    });

    describe('checkGuildAccess', () => {
        it('should return error if guildId is missing', () => {
            const result = checkGuildAccess([], undefined);
            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Missing guild ID');
            expect(result.statusCode).toBe(400);
        });

        it('should return error if guilds is not an array', () => {
            const result = checkGuildAccess(undefined, '123');
            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Guild data unavailable');
            expect(result.statusCode).toBe(503);
        });

        it('should return error if user is not admin', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: false, permissions: '0' }
            ];
            const result = checkGuildAccess(guilds, '123');
            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Not authorized for this guild');
            expect(result.statusCode).toBe(403);
        });

        it('should return success if user is admin', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: true, permissions: '0' }
            ];
            const result = checkGuildAccess(guilds, '123');
            expect(result.hasAccess).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.statusCode).toBeUndefined();
        });

        it('should return success if user has administrator permission', () => {
            const guilds: MinimalGuildData[] = [
                { id: '123', owner: false, permissions: String(DISCORD_PERMISSION_ADMINISTRATOR) }
            ];
            const result = checkGuildAccess(guilds, '123');
            expect(result.hasAccess).toBe(true);
        });
    });

    describe('DISCORD_PERMISSION_ADMINISTRATOR', () => {
        it('should have correct value', () => {
            expect(DISCORD_PERMISSION_ADMINISTRATOR).toBe(0x8);
        });
    });
});
