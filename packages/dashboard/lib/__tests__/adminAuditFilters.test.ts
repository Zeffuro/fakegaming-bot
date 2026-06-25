import { describe, expect, it } from 'vitest';
import {
    countAdminAuditFilters,
    createDefaultAdminAuditFilters,
    parseAdminAuditFilters,
    serializeAdminAuditFilters,
} from '@/lib/adminAuditFilters';

function params(value: string): URLSearchParams {
    return new URLSearchParams(value);
}

describe('admin audit filters', () => {
    it('parses supported filter params and normalizes provider scope', () => {
        expect(parseAdminAuditFilters(params('status=failure&severity=error&provider=riot&guildId=123&limit=100&offset=25'))).toEqual({
            limit: 100,
            offset: 25,
            guildId: '123',
            scope: 'integrations',
            provider: 'riot',
            severity: 'error',
            status: 'failure',
        });
    });

    it('drops unsupported enum params and invalid pagination', () => {
        expect(parseAdminAuditFilters(params('status=bad&severity=nope&provider=steamnews&limit=999&offset=-5'))).toEqual(createDefaultAdminAuditFilters());
    });

    it('serializes filters in stable order and omits default pagination', () => {
        expect(serializeAdminAuditFilters({
            action: 'integration.update',
            targetType: 'integration',
            actorId: 'user-1',
            guildId: 'guild-1',
            scope: 'integrations',
            provider: 'youtube',
            severity: 'warn',
            status: 'failure',
            limit: 50,
            offset: 0,
        })).toBe('action=integration.update&targetType=integration&actorId=user-1&guildId=guild-1&scope=integrations&provider=youtube&severity=warn&status=failure');
    });

    it('includes non-default pagination and counts only active filters', () => {
        const filters = {
            status: 'failure' as const,
            limit: 25,
            offset: 50,
        };

        expect(serializeAdminAuditFilters(filters)).toBe('status=failure&limit=25&offset=50');
        expect(countAdminAuditFilters(filters)).toBe(1);
    });
});
