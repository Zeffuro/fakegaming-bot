import { describe, it, expect } from 'vitest';
import { isGuildAdmin, DISCORD_PERMISSION_ADMINISTRATOR } from '@/lib/constants';

describe('constants.isGuildAdmin', () => {
    it('returns true when user is guild owner', () => {
        const guilds = [{ id: '1', owner: true, permissions: '0' }];
        expect(isGuildAdmin(guilds as any, '1')).toBe(true);
    });

    it('returns true when admin permission bit is set', () => {
        const guilds = [{ id: '2', owner: false, permissions: String(DISCORD_PERMISSION_ADMINISTRATOR) }];
        expect(isGuildAdmin(guilds as any, '2')).toBe(true);
    });

    it('returns false when not owner and no admin permission', () => {
        const guilds = [{ id: '3', owner: false, permissions: '0' }];
        expect(isGuildAdmin(guilds as any, '3')).toBe(false);
    });

    it('returns false when guild not found', () => {
        const guilds = [{ id: '4', owner: true, permissions: '8' }];
        expect(isGuildAdmin(guilds as any, 'missing')).toBe(false);
    });
});
