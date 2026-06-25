import { afterEach, describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { useTwitchConfigs } from '@/components/hooks/useTwitch';
import { api } from '@/lib/api-client';
import { mountWithSnapshots, createHookProbe1 } from '../testing/reactTesting';

// Use shared probe component for a hook with one argument
const HookProbe = createHookProbe1((arg: string) => useTwitchConfigs(arg));

describe('useTwitchConfigs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads and filters configs by guildId', async () => {
        const guildId = '123';
        vi.spyOn(api, 'getTwitchConfigs').mockResolvedValueOnce([
            { id: 1, guildId: '123', twitchUsername: 'a', discordChannelId: 'c1' },
            { id: 2, guildId: '999', twitchUsername: 'b', discordChannelId: 'c2' },
        ] as any);

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { arg: guildId, onSnapshot })
        );

        const final = last();
        expect(Array.isArray(final?.configs)).toBe(true);
        expect(final?.configs).toEqual([{ id: 1, guildId: '123', twitchUsername: 'a', discordChannelId: 'c1' }]);
        expect(final?.loading).toBe(false);
        expect(final?.error).toBeNull();

        unmount();
    });

    it('validates addConfig required fields and sets error', async () => {
        const guildId = 'g1';
        vi.spyOn(api, 'getTwitchConfigs').mockResolvedValueOnce([] as any);
        const createSpy = vi.spyOn(api, 'createTwitchStream').mockResolvedValue({ success: true } as any);

        const { last, flush, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { arg: guildId, onSnapshot })
        );

        // call addConfig with missing fields
        let state = last() as any;
        let result: any;
        await act(async () => {
            result = await state.addConfig({ twitchUsername: '', discordChannelId: '', customMessage: undefined });
            await Promise.resolve();
        });
        await flush();

        state = last() as any;
        expect(result).toBe(false);
        expect(state.error).toBe('Twitch Channel Name and Discord Channel ID are required');
        expect(createSpy).not.toHaveBeenCalled();

        unmount();
    });

    it('bulk pauses only active configs and refreshes once', async () => {
        const guildId = 'g1';
        const configs = [
            { id: 1, guildId, twitchUsername: 'active-one', discordChannelId: 'c1', paused: false },
            { id: 2, guildId, twitchUsername: 'paused-one', discordChannelId: 'c2', paused: true },
            { id: 3, guildId, twitchUsername: 'active-two', discordChannelId: 'c3', paused: false },
        ];
        const loadSpy = vi.spyOn(api, 'getTwitchConfigs').mockResolvedValue(configs as any);
        const updateSpy = vi.spyOn(api, 'updateTwitchStream').mockResolvedValue({} as any);

        const { last, flush, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { arg: guildId, onSnapshot })
        );

        let result = false;
        await act(async () => {
            result = await (last() as any).setAllPausedConfigs(true);
        });
        await flush();

        expect(result).toBe(true);
        expect(updateSpy).toHaveBeenCalledTimes(2);
        expect(updateSpy).toHaveBeenCalledWith(1, { paused: true });
        expect(updateSpy).toHaveBeenCalledWith(3, { paused: true });
        expect(loadSpy).toHaveBeenCalledTimes(2);

        unmount();
    });

    it('updates configs with PUT and preserves VOD follow-up fields', async () => {
        const guildId = 'g1';
        const configs = [
            {
                id: 7,
                guildId,
                twitchUsername: 'creator',
                discordChannelId: 'c1',
                customMessage: 'Live {url}',
                vodFollowupEnabled: true,
                vodFollowupDelayMinutes: 20,
            },
        ];
        vi.spyOn(api, 'getTwitchConfigs').mockResolvedValue(configs as any);
        const updateSpy = vi.spyOn(api, 'updateTwitchStream').mockResolvedValue({} as any);
        const deleteSpy = vi.spyOn(api, 'deleteTwitchStream').mockResolvedValue({ success: true });
        const createSpy = vi.spyOn(api, 'createTwitchStream').mockResolvedValue({ success: true } as any);

        const { last, flush, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { arg: guildId, onSnapshot })
        );

        let result = false;
        await act(async () => {
            result = await (last() as any).updateConfig(configs[0]);
        });
        await flush();

        expect(result).toBe(true);
        expect(updateSpy).toHaveBeenCalledWith(7, expect.objectContaining({
            twitchUsername: 'creator',
            discordChannelId: 'c1',
            guildId,
            vodFollowupEnabled: true,
            vodFollowupDelayMinutes: 20,
        }));
        expect(deleteSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();

        unmount();
    });
});
