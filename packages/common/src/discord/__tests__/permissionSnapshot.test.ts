import { describe, expect, it } from 'vitest';
import {
    permissionNamesFromBitfield,
    rolePermissionChannelKind,
    rolePermissionOverwriteType,
} from '../permissionSnapshot.js';

describe('permission snapshots', () => {
    it('maps Discord permission bitfields without loading the Discord gateway client', () => {
        const permissions = permissionNamesFromBitfield((1n << 3n) | (1n << 10n) | (1n << 52n));

        expect(permissions).toEqual(['Administrator', 'BypassSlowmode', 'ViewChannel']);
    });

    it('maps Discord channel and overwrite types', () => {
        expect(rolePermissionChannelKind(4)).toBe('category');
        expect(rolePermissionChannelKind(16)).toBe('media');
        expect(rolePermissionChannelKind(99)).toBe('unknown');
        expect(rolePermissionOverwriteType(0)).toBe('role');
        expect(rolePermissionOverwriteType(1)).toBe('member');
        expect(rolePermissionOverwriteType('role')).toBe('role');
        expect(rolePermissionOverwriteType('member')).toBe('member');
        expect(rolePermissionOverwriteType(99)).toBe('unknown');
    });
});
