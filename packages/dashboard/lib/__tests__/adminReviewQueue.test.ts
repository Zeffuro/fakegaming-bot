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
    it('groups operational integration summaries with detailed failing records', () => {
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
            'jobs:anime-digest:failed',
            'audit:44',
            'operations:health-warnings',
        ]);
        expect(queue[0]).toMatchObject({
            detail: '2 integration records currently failing. Includes 1 visible detail, plus 1 more summarized by the overview.',
            relatedItems: [
                expect.objectContaining({
                    id: 'integration-health:Patch Notes:patch-1',
                    title: 'Patch Notes config patch-1',
                    detail: 'Remote feed timed out - 2 consecutive failures - Next: Retry after a short interval and check provider status if failures continue.',
                    href: '/dashboard/admin/integration-health?status=error&provider=patchnotes&guildId=guild-1',
                }),
            ],
        });
        expect(queue[1]).toMatchObject({
            id: 'jobs:anime-digest:failed',
            href: '/dashboard/admin/jobs?job=anime-digest&result=failed',
        });
        expect(queue[0].relatedItems?.[0]).toMatchObject({
            title: 'Patch Notes config patch-1',
            detail: 'Remote feed timed out - 2 consecutive failures - Next: Retry after a short interval and check provider status if failures continue.',
            href: '/dashboard/admin/integration-health?status=error&provider=patchnotes&guildId=guild-1',
        });
        expect(queue[2]).toMatchObject({
            id: 'audit:44',
            href: '/dashboard/admin/audit?status=failure&action=integration.delete&guildId=guild-1&severity=error',
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
                detail: 'FETCH_FAILED - No consecutive failures recorded - Next: Retry after a short interval and check provider status if failures continue.',
                href: '/dashboard/admin/integration-health?status=unknown&provider=youtube&guildId=guild-1',
            }),
        ]);
    });

    it('includes cooldown state in provider health details', () => {
        const queue = buildAdminReviewQueue({
            healthRecords: [
                healthRecord({
                    status: 'warning',
                    consecutiveFailures: 1,
                    lastErrorMessage: 'Delivery suppressed',
                    metadata: { suppressedByCooldown: true },
                }),
            ],
        });

        expect(queue).toEqual([
            expect.objectContaining({
                id: 'integration-health:twitch:config-1',
                detail: 'Delivery suppressed - 1 consecutive failure - Cooldown: last delivery suppressed - Next: Retry after a short interval and check provider status if failures continue.',
            }),
        ]);
    });

    it('groups failed and unavailable job details under matching operation summaries', () => {
        const queue = buildAdminReviewQueue({
            operationsHealth: {
                issues: [
                    { label: 'Failed job runs', value: 3, severity: 'critical', href: '/dashboard/admin/jobs' },
                    { label: 'Job status unavailable', value: 1, severity: 'critical', href: '/dashboard/admin/jobs' },
                ],
            },
            jobs: [
                {
                    name: 'twitch',
                    latestRun: {
                        startedAt: '2026-06-22T11:00:00.000Z',
                        finishedAt: '2026-06-22T11:01:00.000Z',
                        ok: false,
                        error: 'Token expired',
                    },
                    failedRecentRuns: 2,
                    totalRecentRuns: 5,
                },
                {
                    name: 'youtube',
                    latestRun: {
                        startedAt: '2026-06-22T11:05:00.000Z',
                        finishedAt: '2026-06-22T11:06:00.000Z',
                        ok: false,
                    },
                    failedRecentRuns: 1,
                    totalRecentRuns: 5,
                },
                {
                    name: 'jobs-api',
                    latestRun: null,
                    failedRecentRuns: 0,
                    totalRecentRuns: 0,
                    error: 'Failed to load status',
                },
            ],
        });

        expect(queue.map(item => item.id)).toEqual([
            'operations:failed-job-runs',
            'operations:job-status-unavailable',
        ]);
        expect(queue[0].relatedItems?.map(item => item.id)).toEqual([
            'jobs:youtube:failed',
            'jobs:twitch:failed',
        ]);
        expect(queue[0].relatedItems?.map(item => item.href)).toEqual([
            '/dashboard/admin/jobs?job=youtube&result=failed',
            '/dashboard/admin/jobs?job=twitch&result=failed',
        ]);
        expect(queue[0].detail).toBe('3 recent job runs failed. Includes 2 visible details, plus 1 more summarized by the overview.');
        expect(queue[1].relatedItems?.map(item => item.id)).toEqual([
            'jobs:jobs-api:unavailable',
        ]);
        expect(queue[1].relatedItems?.map(item => item.href)).toEqual([
            '/dashboard/admin/jobs?job=jobs-api',
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

    it('includes Riot League form audit metadata in failed review queue items', () => {
        const queue = buildAdminReviewQueue({
            auditEvents: [
                auditEvent({
                    id: 55,
                    action: 'riot.leagueForm',
                    targetType: 'riotRecentForm',
                    targetId: 'EUW1',
                    severity: 'error',
                    metadata: {
                        provider: 'riot',
                        game: 'league',
                        outcome: 'history_failure',
                        cacheStatus: 'miss',
                        errorCategory: 'rate_limited',
                    },
                }),
            ],
        });

        expect(queue).toEqual([
            expect.objectContaining({
                id: 'audit:55',
                title: 'Audit failed: Riot League form',
                detail: 'user:user-1 -> riotRecentForm:EUW1 - League form history_failure - cache miss - rate_limited',
                href: '/dashboard/admin/audit?status=failure&action=riot.leagueForm&scope=integrations&provider=riot&guildId=guild-1&severity=error',
            }),
        ]);
    });

    it('links Riot League form identity failures back to the Riot audit filter', () => {
        const queue = buildAdminReviewQueue({
            auditEvents: [
                auditEvent({
                    id: 56,
                    action: 'riot.leagueForm',
                    targetType: 'riotRecentForm',
                    targetId: null,
                    severity: 'error',
                    metadata: {
                        provider: 'riot',
                        game: 'league',
                        outcome: 'identity_failure',
                        cacheStatus: 'not_checked',
                        errorCategory: 'missing_key',
                    },
                }),
            ],
        });

        expect(queue).toEqual([
            expect.objectContaining({
                id: 'audit:56',
                title: 'Audit failed: Riot League form',
                detail: 'user:user-1 -> riotRecentForm - League form identity_failure - cache not_checked - missing_key',
                href: '/dashboard/admin/audit?status=failure&action=riot.leagueForm&scope=integrations&provider=riot&guildId=guild-1&severity=error',
            }),
        ]);
    });
});
