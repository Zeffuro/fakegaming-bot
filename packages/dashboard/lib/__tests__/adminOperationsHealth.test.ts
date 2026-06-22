import { describe, expect, it } from 'vitest';
import { buildAdminOperationsHealth } from '@/lib/adminOperationsHealth';

const now = new Date('2026-06-22T12:00:00.000Z');

function healthySummary() {
    return {
        total: 4,
        healthy: 4,
        warning: 0,
        error: 0,
        paused: 0,
        unknown: 0,
    };
}

describe('buildAdminOperationsHealth', () => {
    it('returns healthy when core operational signals are clean', () => {
        expect(buildAdminOperationsHealth({
            integrationSummary: healthySummary(),
            jobs: [{ failedRecentRuns: 0 }],
            heartbeat: { receivedAt: '2026-06-22T11:58:30.000Z' },
            now,
        })).toEqual({
            status: 'healthy',
            title: 'Healthy',
            description: 'No current integration, job, or heartbeat issues detected.',
            issues: [],
            heartbeatAgeMinutes: 1,
        });
    });

    it('returns warning for non-critical health issues and partial overview data', () => {
        const health = buildAdminOperationsHealth({
            integrationSummary: {
                ...healthySummary(),
                warning: 2,
                unknown: 1,
            },
            jobs: [{ failedRecentRuns: 0 }],
            heartbeat: null,
            overviewError: 'audit events failed',
            now,
        });

        expect(health).toMatchObject({
            status: 'warning',
            title: 'Monitor Closely',
        });
        expect(health.issues).toEqual([
            {
                label: 'Health warnings',
                value: 3,
                severity: 'warning',
                href: '/dashboard/admin/integration-health?status=all',
            },
            {
                label: 'Missing worker heartbeat',
                value: 1,
                severity: 'warning',
                href: '/dashboard/admin/jobs',
            },
            {
                label: 'Partial overview data',
                value: 1,
                severity: 'warning',
            },
        ]);
    });

    it('returns critical for integration errors, job failures, unavailable job status, and stale heartbeat', () => {
        const health = buildAdminOperationsHealth({
            integrationSummary: {
                ...healthySummary(),
                error: 2,
            },
            jobs: [
                { failedRecentRuns: 3 },
                { failedRecentRuns: 0, error: 'status failed' },
            ],
            heartbeat: { receivedAt: '2026-06-22T11:42:00.000Z' },
            now,
        });

        expect(health).toMatchObject({
            status: 'critical',
            title: 'Attention Needed',
        });
        expect(health.heartbeatAgeMinutes).toBe(18);
        expect(health.issues).toMatchObject([
            { label: 'Integration errors', value: 2, severity: 'critical' },
            { label: 'Failed job runs', value: 3, severity: 'critical' },
            { label: 'Job status unavailable', value: 1, severity: 'critical' },
            { label: 'Stale worker heartbeat', value: 18, severity: 'critical' },
        ]);
    });
});
