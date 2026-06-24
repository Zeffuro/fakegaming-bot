import { describe, expect, it } from 'vitest';
import {
    formatAdminProviderPlaybookSummary,
    getAdminProviderPlaybookHint,
} from '@/lib/adminProviderPlaybooks';

describe('adminProviderPlaybooks', () => {
    it('maps explicit provider error codes to next steps', () => {
        expect(getAdminProviderPlaybookHint({
            provider: 'twitch',
            lastErrorCode: 'TWITCH_AUTH_FAILED',
            lastErrorMessage: 'invalid client',
            consecutiveFailures: 1,
        })).toEqual({
            id: 'twitch-auth',
            title: 'Twitch auth failed',
            summary: 'The worker could not get a Twitch app token.',
            nextStep: 'Check Twitch client ID and secret, then confirm the Twitch app is still active.',
            urgency: 'critical',
        });

        expect(getAdminProviderPlaybookHint({
            provider: 'youtube',
            lastErrorCode: 'YOUTUBE_FEED_UNAVAILABLE',
            consecutiveFailures: 1,
        })).toMatchObject({
            id: 'youtube-feed-unavailable',
            urgency: 'warning',
        });

        expect(getAdminProviderPlaybookHint({
            provider: 'tiktok',
            lastErrorCode: 'TIKTOK_AUTH_REQUIRED',
            consecutiveFailures: 1,
        })).toMatchObject({
            id: 'tiktok-auth-required',
            title: 'TikTok session likely required',
            urgency: 'critical',
        });
    });

    it('falls back to message-based playbooks when the error code is generic', () => {
        expect(getAdminProviderPlaybookHint({
            provider: 'steamnews',
            lastErrorCode: 'Error',
            lastErrorMessage: 'Request failed with 429 too many requests',
            consecutiveFailures: 2,
        })).toMatchObject({
            id: 'rate-limit',
            title: 'Provider rate limit',
            urgency: 'warning',
        });

        expect(getAdminProviderPlaybookHint({
            provider: 'bluesky',
            lastErrorMessage: 'fetch timed out',
            consecutiveFailures: 5,
        })).toMatchObject({
            id: 'network',
            urgency: 'critical',
        });
    });

    it('returns an unknown-state hint without an error payload', () => {
        expect(getAdminProviderPlaybookHint({
            provider: 'tiktok',
            status: 'unknown',
        })).toEqual({
            id: 'unknown-status',
            title: 'Unknown health state',
            summary: 'The worker has not reported enough recent data for this integration.',
            nextStep: 'Check the worker heartbeat and wait for the next provider poll before changing config.',
            urgency: 'info',
        });
    });

    it('formats queue-friendly playbook summaries', () => {
        const hint = getAdminProviderPlaybookHint({
            provider: 'patchnotes',
            lastErrorCode: 'DISCORD_SEND_FAILED',
            consecutiveFailures: 3,
        });

        expect(formatAdminProviderPlaybookSummary(hint)).toBe('Next: Check the destination channel exists and the bot can view and send messages there.');
        expect(formatAdminProviderPlaybookSummary(null)).toBeNull();
    });
});
