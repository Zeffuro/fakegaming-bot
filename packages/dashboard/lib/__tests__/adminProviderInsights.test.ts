import { describe, expect, it } from 'vitest';
import { buildAdminProviderInsights } from '@/lib/adminProviderInsights';
import type { IntegrationHealthRecord } from '@/lib/api-client';

function healthRecord(partial: Partial<IntegrationHealthRecord>): IntegrationHealthRecord {
    return {
        id: 1,
        provider: 'twitch',
        configId: 'config-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        status: 'error',
        consecutiveFailures: 1,
        ...partial,
    };
}

describe('buildAdminProviderInsights', () => {
    it('groups visible health errors with provider delivery counts', () => {
        const insights = buildAdminProviderInsights({
            healthRecords: [
                healthRecord({ provider: 'twitch', configId: 'twitch-1', consecutiveFailures: 3, guildId: 'guild-1' }),
                healthRecord({ provider: 'Twitch', configId: 'twitch-2', consecutiveFailures: 2, guildId: 'guild-2' }),
                healthRecord({ provider: 'youtube', configId: 'youtube-1', consecutiveFailures: 1, guildId: 'guild-1' }),
                healthRecord({ provider: 'bluesky', status: 'healthy', consecutiveFailures: 0 }),
            ],
            notificationProviders: [
                { provider: 'twitch', count: 10 },
                { provider: 'youtube', count: 4 },
                { provider: 'bluesky', count: 7 },
            ],
        });

        expect(insights).toMatchObject([
            {
                provider: 'Twitch',
                providerKey: 'twitch',
                healthErrors: 2,
                consecutiveFailures: 5,
                affectedGuilds: 2,
                deliveries: 10,
                state: 'needs-review',
                href: '/dashboard/admin/integration-health?provider=twitch&status=error',
            },
            {
                provider: 'YouTube',
                providerKey: 'youtube',
                healthErrors: 1,
                consecutiveFailures: 1,
                affectedGuilds: 1,
                deliveries: 4,
                state: 'needs-review',
                href: '/dashboard/admin/integration-health?provider=youtube&status=error',
            },
            {
                provider: 'Bluesky',
                providerKey: 'bluesky',
                healthErrors: 0,
                deliveries: 7,
                state: 'active',
                href: '/dashboard/admin/notifications?provider=bluesky',
            },
        ]);
    });

    it('normalizes patch note provider labels and skips empty providers', () => {
        const insights = buildAdminProviderInsights({
            healthRecords: [
                healthRecord({ provider: 'Patch Notes', configId: 'patch-1', consecutiveFailures: 4 }),
                healthRecord({ provider: '   ', configId: 'empty-provider' }),
            ],
            notificationProviders: [
                { provider: 'patch_notes', count: 3 },
                { provider: '', count: 99 },
            ],
        });

        expect(insights).toEqual([
            {
                provider: 'Patch Notes',
                providerKey: 'patchnotes',
                healthErrors: 1,
                consecutiveFailures: 4,
                affectedGuilds: 1,
                deliveries: 3,
                state: 'needs-review',
                href: '/dashboard/admin/integration-health?provider=patchnotes&status=error',
            },
        ]);
    });
});
