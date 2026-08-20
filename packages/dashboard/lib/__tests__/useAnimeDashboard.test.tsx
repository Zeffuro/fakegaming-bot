import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { useAnimeDashboard } from '@/components/hooks/useAnimeDashboard';
import { api } from '@/lib/api-client';
import { createHookProbe1, mountWithSnapshots } from '../testing/reactTesting';
import { DashboardI18nProvider } from '@/components/i18n/DashboardI18nProvider';
import { DASHBOARD_LOCALE_STORAGE_KEY } from '@/lib/i18n/localeStore';

const HookProbe = createHookProbe1((arg: string) => useAnimeDashboard(arg));

function renderProbe(onSnapshot: (snap: any) => void): React.ReactElement {
    return React.createElement(
        DashboardI18nProvider,
        null,
        React.createElement(HookProbe as any, { arg: 'guild-1', onSnapshot }),
    );
}

describe('useAnimeDashboard', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.localStorage.clear();
    });

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

        const { last, flush, unmount } = await mountWithSnapshots(renderProbe);

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

    it('deletes selected subscriptions and skips entries without ids', async () => {
        const serverSubs = [
            { id: 11, anilistId: 101, animeTitle: 'Airing One', guildId: 'guild-1', channelId: 'channel-1', discordChannelId: 'channel-1', reminderMinutes: 30, paused: false },
            { id: 12, anilistId: 102, animeTitle: 'Airing Two', guildId: 'guild-1', channelId: 'channel-2', discordChannelId: 'channel-2', reminderMinutes: 15, paused: false },
        ];

        vi.spyOn(api, 'getAnimeSubscriptions').mockResolvedValue(serverSubs as any);
        vi.spyOn(api, 'getMyAnimeSubscriptions').mockResolvedValue([]);
        vi.spyOn(api, 'getAnimeSeason').mockResolvedValue({
            season: 'SUMMER',
            year: 2026,
            scope: 'airing',
            scopeLabel: 'Airing / Upcoming',
            results: [],
            pageInfo: { hasNextPage: false },
        } as any);
        const deleteSpy = vi.spyOn(api, 'deleteAnimeSubscription').mockResolvedValue({ success: true });

        const { last, flush, unmount } = await mountWithSnapshots(renderProbe);

        await act(async () => {
            await (last() as any).deleteSubscriptions([
                serverSubs[0],
                { anilistId: 999, animeTitle: 'Unsaved', guildId: 'guild-1', discordChannelId: 'channel-3', reminderMinutes: 30 },
                serverSubs[1],
            ]);
        });
        await flush();

        expect(deleteSpy).toHaveBeenCalledTimes(2);
        expect(deleteSpy).toHaveBeenCalledWith(11);
        expect(deleteSpy).toHaveBeenCalledWith(12);

        unmount();
    });

    it('uses Dutch fallback errors and season labels without translating provider titles', async () => {
        window.localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, 'nl');
        vi.spyOn(api, 'getAnimeSubscriptions').mockRejectedValue('offline');
        vi.spyOn(api, 'getMyAnimeSubscriptions').mockResolvedValue([]);
        vi.spyOn(api, 'getAnimeSeason').mockResolvedValue({
            season: 'SUMMER',
            year: 2026,
            scope: 'airing',
            scopeLabel: 'Airing / Upcoming',
            results: [],
            pageInfo: { hasNextPage: false },
        } as any);

        const { last, unmount } = await mountWithSnapshots(renderProbe);

        expect((last() as any).error).toBe('Anime-abonnementen laden mislukt');
        expect((last() as any).seasonLabel).toBe('Zomer 2026 - Wordt uitgezonden / binnenkort');

        unmount();
    });
});
