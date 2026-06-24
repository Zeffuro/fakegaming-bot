import { describe, expect, it } from 'vitest';
import {
    buildAdminSavedViewHref,
    createAdminSavedView,
    getAdminSavedViewsForScope,
    normalizeSavedViewQuery,
    parseAdminSavedViews,
    removeAdminSavedView,
    serializeAdminSavedViews,
    upsertAdminSavedView,
    type AdminSavedView,
} from '@/lib/adminSavedViews';

function savedView(partial: Partial<AdminSavedView>): AdminSavedView {
    return {
        id: 'view-1',
        scope: 'audit',
        label: 'Failed audit',
        query: 'status=failure',
        createdAt: '2026-06-23T10:00:00.000Z',
        ...partial,
    };
}

describe('adminSavedViews', () => {
    it('normalizes saved view query strings and removes pagination offsets', () => {
        expect(normalizeSavedViewQuery('?offset=50&status=failure&provider=twitch&empty=')).toBe('provider=twitch&status=failure');
        expect(buildAdminSavedViewHref('/dashboard/admin/audit', 'status=failure&offset=25')).toBe('/dashboard/admin/audit?status=failure');
    });

    it('creates valid saved views with trimmed labels and query payloads', () => {
        const view = createAdminSavedView({
            id: 'fixed',
            scope: 'integration-health',
            label: '  Failing Twitch configs  ',
            query: '?status=error&provider=twitch&offset=50',
            createdAt: '2026-06-23T10:00:00.000Z',
        });

        expect(view).toEqual({
            id: 'fixed',
            scope: 'integration-health',
            label: 'Failing Twitch configs',
            query: 'provider=twitch&status=error',
            createdAt: '2026-06-23T10:00:00.000Z',
        });
        expect(createAdminSavedView({ scope: 'audit', label: ' ', query: 'status=failure' })).toBeNull();
        expect(createAdminSavedView({ scope: 'audit', label: 'Failed', query: '' })).toBeNull();
    });

    it('parses and serializes only valid saved views', () => {
        const serialized = serializeAdminSavedViews([
            savedView({ id: 'a', label: 'Failed audit' }),
            savedView({ id: 'b', scope: 'jobs', query: 'job=heartbeat&result=failed' }),
        ]);

        expect(parseAdminSavedViews(serialized)).toEqual([
            savedView({ id: 'a', label: 'Failed audit' }),
            savedView({ id: 'b', scope: 'jobs', query: 'job=heartbeat&result=failed' }),
        ]);
        expect(parseAdminSavedViews('not-json')).toEqual([]);
        expect(parseAdminSavedViews(JSON.stringify({ version: 99, views: [] }))).toEqual([]);
    });

    it('upserts by scope and query while keeping newest scoped views first', () => {
        const existing = [
            savedView({ id: 'old-audit', query: 'status=failure', createdAt: '2026-06-23T09:00:00.000Z' }),
            savedView({ id: 'other-scope', scope: 'jobs', query: 'result=failed' }),
        ];
        const next = upsertAdminSavedView(existing, savedView({
            id: 'new-audit',
            query: 'status=failure',
            createdAt: '2026-06-23T11:00:00.000Z',
        }));

        expect(next).toEqual([
            savedView({ id: 'new-audit', query: 'status=failure', createdAt: '2026-06-23T11:00:00.000Z' }),
            savedView({ id: 'other-scope', scope: 'jobs', query: 'result=failed' }),
        ]);
    });

    it('filters saved views by scope and removes them by id', () => {
        const views = [
            savedView({ id: 'audit-old', createdAt: '2026-06-23T09:00:00.000Z' }),
            savedView({ id: 'audit-new', query: 'severity=error', createdAt: '2026-06-23T11:00:00.000Z' }),
            savedView({ id: 'jobs', scope: 'jobs', query: 'result=failed' }),
        ];

        expect(getAdminSavedViewsForScope(views, 'audit').map(view => view.id)).toEqual(['audit-new', 'audit-old']);
        expect(removeAdminSavedView(views, 'audit-old').map(view => view.id)).toEqual(['audit-new', 'jobs']);
    });
});
