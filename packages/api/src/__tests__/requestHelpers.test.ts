/**
 * Tests for request helper utilities
 */
import { describe, it, expect } from 'vitest';
import { getStringQueryParam, isGuildAdmin } from '../utils/requestHelpers.js';

describe('getStringQueryParam', () => {
    it('should return string value if present', () => {
        const query = { key: 'value' };
        expect(getStringQueryParam(query, 'key')).toBe('value');
    });

    it('should return undefined if key is missing', () => {
        const query = {};
        expect(getStringQueryParam(query, 'key')).toBeUndefined();
    });

    it('should convert non-string values to string', () => {
        const query = { key: 123 };
        expect(getStringQueryParam(query, 'key')).toBe('123');
    });

    it('should handle boolean values', () => {
        const query = { key: true };
        expect(getStringQueryParam(query, 'key')).toBe('true');
    });

    it('should return undefined for undefined values', () => {
        const query = { key: undefined };
        expect(getStringQueryParam(query, 'key')).toBeUndefined();
    });
});

describe('isGuildAdmin', () => {
    it('should return false if guildId is undefined', () => {
        const guilds = [{ id: '123', owner: false, permissions: '0' }];
        expect(isGuildAdmin(guilds, undefined)).toBe(false);
    });

    it('should return false if guilds is not an array', () => {
        expect(isGuildAdmin(undefined, '123')).toBe(false);
        expect(isGuildAdmin(null as any, '123')).toBe(false);
    });

    it('should return false if guild not found', () => {
        const guilds = [{ id: '123', owner: false, permissions: '0' }];
        expect(isGuildAdmin(guilds, '456')).toBe(false);
    });

    it('should return true if user is guild owner', () => {
        const guilds = [{ id: '123', owner: true, permissions: '0' }];
        expect(isGuildAdmin(guilds, '123')).toBe(true);
    });

    it('should return true if user has administrator permission (0x8)', () => {
        const guilds = [{ id: '123', owner: false, permissions: '8' }];
        expect(isGuildAdmin(guilds, '123')).toBe(true);
    });

    it('should return true if user has admin among other permissions', () => {
        const guilds = [{ id: '123', owner: false, permissions: String(0x8 | 0x400) }];
        expect(isGuildAdmin(guilds, '123')).toBe(true);
    });

    it('should return false if user does not have admin permission', () => {
        const guilds = [{ id: '123', owner: false, permissions: '1024' }];
        expect(isGuildAdmin(guilds, '123')).toBe(false);
    });

    it('should return false if permissions is undefined', () => {
        const guilds = [{ id: '123', owner: false }];
        expect(isGuildAdmin(guilds, '123')).toBe(false);
    });
});

