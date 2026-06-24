import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordIntegrationFailure, recordIntegrationSuccess } from '../integrationHealth.js';

const hoisted = vi.hoisted(() => ({
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        integrationHealthManager: {
            recordSuccess: hoisted.recordSuccess,
            recordFailure: hoisted.recordFailure,
        },
    }),
}));

describe('integration health job recorder', () => {
    beforeEach(() => {
        hoisted.recordSuccess.mockReset();
        hoisted.recordFailure.mockReset();
    });

    it('adds safe cooldown metadata when recording success', async () => {
        await recordIntegrationSuccess('twitch', {
            id: 'cfg-1',
            guildId: 'guild-1',
            discordChannelId: 'channel-1',
            cooldownMinutes: 10,
            lastNotifiedAt: '2026-06-23T10:00:00.000Z',
            paused: false,
        }, {
            delivered: false,
            checkedAt: new Date('2026-06-23T10:05:00.000Z'),
            metadata: { username: 'streamer' },
        });

        expect(hoisted.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'twitch',
            configId: 'cfg-1',
            guildId: 'guild-1',
            channelId: 'channel-1',
            metadata: {
                paused: false,
                cooldownMinutes: 10,
                lastNotifiedAt: '2026-06-23T10:00:00.000Z',
                cooldownUntil: '2026-06-23T10:10:00.000Z',
                cooldownActive: true,
                username: 'streamer',
            },
        }));
    });

    it('adds safe cooldown metadata when recording failure', async () => {
        await recordIntegrationFailure('steamnews', {
            id: 7,
            guildId: 'guild-2',
            channelId: 'channel-2',
            cooldownMinutes: '30',
            lastAnnouncedAt: '2026-06-23T09:00:00.000Z',
            paused: 0,
        }, new Error('poll failed'), {
            errorCode: 'STEAM_NEWS_POLL_FAILED',
            checkedAt: new Date('2026-06-23T10:05:00.000Z'),
            metadata: { steamAppId: 123 },
        });

        expect(hoisted.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'steamnews',
            configId: 7,
            errorCode: 'STEAM_NEWS_POLL_FAILED',
            errorMessage: 'poll failed',
            metadata: {
                paused: false,
                cooldownMinutes: 30,
                lastNotifiedAt: '2026-06-23T09:00:00.000Z',
                cooldownUntil: '2026-06-23T09:30:00.000Z',
                cooldownActive: false,
                steamAppId: 123,
            },
        }));
    });
});
