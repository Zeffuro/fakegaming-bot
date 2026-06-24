import { describe, expect, it } from 'vitest';
import {
    buildAdminAuditCsvRows,
    buildAdminIntegrationHealthCsvRows,
    buildAdminJobRunCsvRows,
} from '@/lib/adminAnalyticsExports';
import type { AuditEventEntry } from '@/lib/api/audit';
import type { IntegrationHealthRecord, JobRunEntry } from '@/lib/api-client';

describe('admin analytics CSV exports', () => {
    it('maps audit events into stable CSV rows', () => {
        const event: AuditEventEntry = {
            id: 10,
            timestamp: '2026-06-24T10:00:00.000Z',
            actorId: 'user-1',
            actorType: 'user',
            action: 'quote.moderation.update',
            targetType: 'quote',
            targetId: 'quote-1',
            guildId: 'guild-1',
            severity: 'info',
            status: 'success',
            requestId: 'req-1',
            metadata: { moderationStatus: 'approved' },
        };

        expect(buildAdminAuditCsvRows([event])).toEqual([[
            10,
            '2026-06-24T10:00:00.000Z',
            'user',
            'user-1',
            'quote.moderation.update',
            'quote',
            'quote-1',
            'guild-1',
            'info',
            'success',
            'req-1',
            '{"moderationStatus":"approved"}',
        ]]);
    });

    it('maps integration health records into stable CSV rows', () => {
        const record: IntegrationHealthRecord = {
            id: 1,
            provider: 'twitch',
            configId: 'config-1',
            guildId: 'guild-1',
            channelId: 'channel-1',
            status: 'error',
            consecutiveFailures: 3,
            lastCheckedAt: '2026-06-24T10:00:00.000Z',
            lastSuccessAt: null,
            lastFailureAt: '2026-06-24T09:55:00.000Z',
            lastDeliveryAt: '2026-06-23T09:55:00.000Z',
            lastErrorCode: 'auth',
            lastErrorMessage: 'Session expired',
            metadata: { cooldownState: 'active' },
        };

        expect(buildAdminIntegrationHealthCsvRows([record])).toEqual([[
            'twitch',
            'config-1',
            'guild-1',
            'channel-1',
            'error',
            3,
            '2026-06-24T10:00:00.000Z',
            null,
            '2026-06-24T09:55:00.000Z',
            '2026-06-23T09:55:00.000Z',
            'auth',
            'Session expired',
            '{"cooldownState":"active"}',
        ]]);
    });

    it('maps job runs into stable CSV rows', () => {
        const run: JobRunEntry = {
            startedAt: '2026-06-24T09:00:00.000Z',
            finishedAt: '2026-06-24T09:00:02.000Z',
            ok: false,
            error: 'DB error',
            meta: { processed: 0 },
        };

        expect(buildAdminJobRunCsvRows('birthdays', [run])).toEqual([[
            'birthdays',
            'failure',
            '2026-06-24T09:00:00.000Z',
            '2026-06-24T09:00:02.000Z',
            'DB error',
            '{"processed":0}',
        ]]);
    });
});
