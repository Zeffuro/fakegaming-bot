import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { useAnimeDashboard } from '@/components/hooks/useAnimeDashboard';
import { api } from '@/lib/api-client';
import { createHookProbe1, mountWithSnapshots } from '../testing/reactTesting';

const HookProbe = createHookProbe1((arg: string) => useAnimeDashboard(arg));

describe('useAnimeDashboard', () => {
    it('bulk updates server and personal subscription paused states separately', async () => {
        const serverSubs = [
            { id: 11, anilistId: 101, animeTitle: 'Airing One', guildId: 'guild-1', channelId: 'channel-1', discordChannelId: 'channel-1', reminderMinutes: 30, paused: false },
            { id: 12, anilistId: 102, animeTitle: 'Paused One', guildId: 'guild-1', channelId: 'channel-2', discordChannelId: 'channel-2', reminderMinutes: 15, paused: true },
        ];
        const personalSubs = [
            { id: 21, anilistId: 201, animeTitle: 'Personal Paused', guildId: 'guild-1', discordChannelId: 'dm', reminderMinutes: 30, paused: true },
            { id: 22, anilistId: 202, animeTitle: 'Personal Active', guildId: 'guild-1', discordChannelId: 'dm', reminderMinutes: 30, paused: false },
        ];

        vi.spyOn(api, 'getAnimeSubscriptions').mockResolvedValue(serverSubs as any);
        vi.spyOn(api, 'getMyAnimeSubscriptions').mockResolvedValue(personalSubs as any);
        vi.spyOn(api, 'getAnimeSeason').mockResolvedValue({
            season: 'SUMMER',
            year: 2026,
            scope: 'airing',
            scopeLabel: 'Airing / Upcoming',
            results: [],
            pageInfo: { hasNextPage: false },
        } as any);
        const pauseSpy = vi.spyOn(api, 'setAnimeSubscriptionPaused').mockResolvedValue({} as any);

        const { last, flush, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { arg: 'guild-1', onSnapshot })
        );

        await act(async () => {
            await (last() as any).setServerSubscriptionsPaused(true);
        });
        await flush();

        expect(pauseSpy).toHaveBeenCalledTimes(1);
        expect(pauseSpy).toHaveBeenCalledWith(11, true);

        pauseSpy.mockClear();

        await act(async () => {
            await (last() as any).setPersonalSubscriptionsPaused(false);
        });
        await flush();

        expect(pauseSpy).toHaveBeenCalledTimes(1);
        expect(pauseSpy).toHaveBeenCalledWith(21, false);

        unmount();
    });
});
