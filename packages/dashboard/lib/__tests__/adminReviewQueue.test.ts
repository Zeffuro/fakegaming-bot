import { describe, expect, it } from 'vitest';
import { buildAdminReviewQueue } from '@/lib/adminReviewQueue';
import type { AuditEventEntry, IntegrationHealthRecord } from '@/lib/api-client';

function healthRecord(partial: Partial<IntegrationHealthRecord>): IntegrationHealthRecord {
    return {
        id: 1,
        provider: 'twitch',
        configId: 'config-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        status: 'error',
        lastCheckedAt: '2026-06-22T11:55:00.000Z',
        lastSuccessAt: null,
        lastFailureAt: '2026-06-22T11:54:00.000Z',
        lastDeliveryAt: null,
        consecutiveFailures: 2,
        lastErrorCode: 'FETCH_FAILED',
        lastErrorMessage: null,
        metadata: null,
        createdAt: '2026-06-22T11:00:00.000Z',
        updatedAt: '2026-06-22T11:55:00.000Z',
        ...partial,
    };
}

function auditEvent(partial: Partial<AuditEventEntry>): AuditEventEntry {
    return {
        id: 1,
        timestamp: '2026-06-22T12:00:00.000Z',
        actorId: 'user-1',
        actorType: 'user',
        action: 'integration.update',
        targetType: 'integration',
        targetId: 'config-1',
        guildId: 'guild-1',
        severity: 'warn',
        status: 'failure',
        requestId: 'request-1',
        metadata: null,
        ...partial,
    };
}

describe('buildAdminReviewQueue', () => {
    it('ranks operational issues before detailed failing records', () => {
        const queue = buildAdminReviewQueue({
            operationsHealth: {
                issues: [
                    {
                        label: 'Integration errors',
                        value: 2,
                        severity: 'critical',
                        href: '/dashboard/admin/integration-health?status=error',
                    },
                    {
                        label: 'Health warnings',
                        value: 1,
                        severity: 'warning',
                        href: '/dashboard/admin/integration-health?status=all',
                    },
                ],
            },
            healthRecords: [
                healthRecord({ provider: 'Patch Notes', configId: 'patch-1', lastErrorMessage: 'Remote feed timed out' }),
            ],
            jobs: [
                {
                    name: 'anime-digest',
                    latestRun: {
                        startedAt: '2026-06-22T11:50:00.000Z',
                        finishedAt: '2026-06-22T11:52:00.000Z',
                        ok: false,
                        error: 'AniList unavailable',
                    },
                    failedRecentRuns: 1,
                    totalRecentRuns: 4,
                },
            ],
            auditEvents: [
                auditEvent({ id: 44, severity: 'error', action: 'integration.delete' }),
            ],
        });

        expect(queue.map(item => item.id)).toEqual([
            'operations:integration-errors',
            'integration-health:Patch Notes:patch-1',
            'jobs:anime-digest:failed',
            'audit:44',
            'operations:health-warnings',
        ]);
        expect(queue[1]).toMatchObject({
            title: 'Patch Notes config patch-1',
            detail: 'Remote feed timed out - 2 consecutive failures',
            severity: 'critical',
            href: '/dashboard/admin/integration-health?status=error&provider=patchnotes&guildId=guild-1',
        });
    });

    it('filters clean records and keeps actionable warning states', () => {
        const queue = buildAdminReviewQueue({
            operationsHealth: {
                issues: [],
            },
            healthRecords: [
                healthRecord({ status: 'healthy', consecutiveFailures: 0 }),
                healthRecord({ id: 2, provider: 'youtube', configId: 'youtube-1', status: 'unknown', consecutiveFailures: 0 }),
            ],
            jobs: [
                {
                    name: 'heartbeat',
                    latestRun: {
                        startedAt: '2026-06-22T11:59:00.000Z',
                        finishedAt: '2026-06-22T12:00:00.000Z',
                        ok: true,
                    },
                    failedRecentRuns: 0,
                    totalRecentRuns: 1,
                },
            ],
            auditEvents: [
                auditEvent({ status: 'success' }),
            ],
        });

        expect(queue).toEqual([
            expect.objectContaining({
                id: 'integration-health:youtube:youtube-1',
                severity: 'warning',
                detail: 'FETCH_FAILED - No consecutive failures recorded',
                href: '/dashboard/admin/integration-health?status=unknown&provider=youtube&guildId=guild-1',
            }),
        ]);
    });

    it('applies the requested limit after priority sorting', () => {
        const queue = buildAdminReviewQueue({
            operationsHealth: {
                issues: [
                    { label: 'Partial overview data', value: 1, severity: 'warning' },
                ],
            },
            jobs: [
                {
                    name: 'job-a',
                    latestRun: null,
                    failedRecentRuns: 0,
                    totalRecentRuns: 0,
                    error: 'Failed to load status',
                },
            ],
            auditEvents: [
                auditEvent({ id: 2, severity: 'warn' }),
            ],
            limit: 1,
        });

        expect(queue).toEqual([
            expect.objectContaining({
                id: 'jobs:job-a:unavailable',
                severity: 'critical',
            }),
        ]);
    });
});
