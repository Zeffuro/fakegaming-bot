import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { usePatchSubscriptions } from '@/components/hooks/usePatchSubscriptions';
import { api } from '@/lib/api-client';
import { createHookProbe1, mountWithSnapshots } from '../testing/reactTesting';

const HookProbe = createHookProbe1((arg: string) => usePatchSubscriptions(arg));

describe('usePatchSubscriptions', () => {
    it('bulk pauses only active subscriptions and refreshes once', async () => {
        const configs = [
            { id: 1, guildId: 'guild-1', game: 'League of Legends', channelId: 'channel-1', paused: false },
            { id: 2, guildId: 'guild-1', game: 'Valorant', channelId: 'channel-2', paused: true },
            { id: 3, guildId: 'guild-1', game: 'Teamfight Tactics', channelId: 'channel-3', paused: false },
        ];
        const loadSpy = vi.spyOn(api, 'getPatchSubscriptions').mockResolvedValue(configs as any);
        const pauseSpy = vi.spyOn(api, 'setPatchSubscriptionPaused').mockResolvedValue({} as any);

        const { last, flush, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { arg: 'guild-1', onSnapshot })
        );

        let result = false;
        await act(async () => {
            result = await (last() as any).setAllPausedConfigs(true);
        });
        await flush();

        expect(result).toBe(true);
        expect(pauseSpy).toHaveBeenCalledTimes(2);
        expect(pauseSpy).toHaveBeenCalledWith(1, true);
        expect(pauseSpy).toHaveBeenCalledWith(3, true);
        expect(loadSpy).toHaveBeenCalledTimes(2);

        unmount();
        loadSpy.mockRestore();
        pauseSpy.mockRestore();
    });
});
