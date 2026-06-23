import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { useMyRiotLink } from '@/components/hooks/useMyRiotLink';
import { api } from '@/lib/api-client';
import { createHookProbe0, mountWithSnapshots } from '../testing/reactTesting';

const HookProbe = createHookProbe0(useMyRiotLink);

describe('useMyRiotLink', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads the authenticated user Riot link', async () => {
        const response = {
            link: {
                discordId: 'user-1',
                summonerName: 'Player#EUW',
                riotIdGameName: 'Player',
                riotIdTagLine: 'EUW',
                region: 'euw1',
                puuid: 'puuid-1',
            },
        };
        const loadSpy = vi.spyOn(api, 'getMyRiotLink').mockResolvedValue(response);

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { onSnapshot })
        );

        expect(loadSpy).toHaveBeenCalledOnce();
        expect(last()?.link).toEqual(response.link);
        expect(last()?.loading).toBe(false);
        expect(last()?.error).toBeNull();

        unmount();
    });

    it('keeps null link state when the authenticated user has no Riot link', async () => {
        vi.spyOn(api, 'getMyRiotLink').mockResolvedValue({ link: null });

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { onSnapshot })
        );

        expect(last()?.link).toBeNull();
        expect(last()?.loading).toBe(false);
        expect(last()?.error).toBeNull();

        unmount();
    });
});
