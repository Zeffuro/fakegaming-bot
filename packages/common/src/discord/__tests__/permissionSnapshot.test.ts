import { describe, expect, it } from 'vitest';
import {
    permissionNamesFromBitfield,
    parseRolePermissionSnapshot,
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

    it('converts valid v2 snapshots to v3 and strips every member profile field', () => {
        const parsed = parseRolePermissionSnapshot(legacySnapshot());

        expect(parsed.version).toBe(3);
        expect(parsed.roles[0]?.members).toEqual([{ id: 'member-1' }]);
        expect(JSON.stringify(parsed)).not.toContain('Private Name');
        expect(JSON.stringify(parsed)).not.toContain('private-user');
    });

    it('rejects unsupported versions and invalid timestamps', () => {
        expect(() => parseRolePermissionSnapshot({ ...legacySnapshot(), version: 1 })).toThrow(/Unsupported/);
        expect(() => parseRolePermissionSnapshot({ ...legacySnapshot(), capturedAt: 'not-a-date' })).toThrow();
    });
});

function legacySnapshot(): Record<string, unknown> {
    return {
        version: 2,
        capturedAt: '2026-08-19T12:00:00.000Z',
        guild: { id: 'guild-1', name: 'Guild', memberCount: 1 },
        roleData: { source: 'fetched', capturedRoleCount: 1, fetchFailed: false },
        memberData: { source: 'fetched', capturedMemberCount: 1, fetchFailed: false },
        channelData: { source: 'fetched', capturedChannelCount: 0, fetchFailed: false },
        roles: [{
            id: 'role-1',
            name: 'Role',
            position: 1,
            color: 0,
            hexColor: '#000000',
            managed: false,
            hoist: false,
            mentionable: false,
            permissions: [],
            permissionsBitfield: '0',
            members: [{
                id: 'member-1',
                username: 'private-user',
                globalName: 'Private Name',
                displayName: 'Private Name',
                nickname: 'Private Name',
            }],
        }],
        channels: [],
    };
}
