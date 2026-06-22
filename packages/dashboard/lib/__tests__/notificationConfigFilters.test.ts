import { describe, expect, it } from 'vitest';
import { filterNotificationConfigs } from '@/lib/notificationConfigFilters';

interface TestConfig {
    id: number;
    guildId: string;
    discordChannelId: string;
    twitchUsername?: string;
    youtubeChannelTitle?: string;
    customMessage?: string;
    paused?: boolean | null;
}

const configs: TestConfig[] = [
    {
        id: 1,
        guildId: 'guild-1',
        discordChannelId: 'channel-live',
        twitchUsername: 'StreamerOne',
        customMessage: 'Going live soon',
        paused: false,
    },
    {
        id: 2,
        guildId: 'guild-1',
        discordChannelId: 'channel-paused',
        twitchUsername: 'StreamerTwo',
        youtubeChannelTitle: 'Video Archive',
        paused: true,
    },
    {
        id: 3,
        guildId: 'guild-1',
        discordChannelId: 'channel-errors',
        twitchUsername: 'StreamerThree',
        paused: false,
    },
];

function getChannelName(channelId: string): string {
    const names = new Map([
        ['channel-live', '#live-now'],
        ['channel-paused', '#clips'],
        ['channel-errors', '#broken-alerts'],
    ]);
    return names.get(channelId) ?? channelId;
}

describe('filterNotificationConfigs', () => {
    it('matches source fields, channel names, titles, custom messages, and ids', () => {
        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            query: 'streamerone',
        }).map((config) => config.id)).toEqual([1]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            query: '#clips',
        }).map((config) => config.id)).toEqual([2]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            query: 'video archive',
        }).map((config) => config.id)).toEqual([2]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            query: 'going live',
        }).map((config) => config.id)).toEqual([1]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            query: '3',
        }).map((config) => config.id)).toEqual([3]);
    });

    it('filters active and paused configs without health records', () => {
        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            status: 'active',
        }).map((config) => config.id)).toEqual([1, 3]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            status: 'paused',
        }).map((config) => config.id)).toEqual([2]);
    });

    it('filters unpaused configs by stored health status', () => {
        const healthByConfigId = new Map([
            ['1', { status: 'healthy' }],
            ['2', { status: 'error' }],
            ['3', { status: 'error' }],
        ]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            healthByConfigId,
            status: 'healthy',
        }).map((config) => config.id)).toEqual([1]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            healthByConfigId,
            status: 'error',
        }).map((config) => config.id)).toEqual([3]);
    });

    it('treats missing health as unknown and excludes paused configs from health filters', () => {
        const healthByConfigId = new Map([
            ['2', { status: 'unknown' }],
        ]);

        expect(filterNotificationConfigs({
            configs,
            channelNameField: 'twitchUsername',
            getChannelName,
            healthByConfigId,
            status: 'unknown',
        }).map((config) => config.id)).toEqual([1, 3]);
    });
});
