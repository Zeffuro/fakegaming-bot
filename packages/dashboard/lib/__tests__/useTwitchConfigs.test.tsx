import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { useTwitchConfigs } from '@/components/hooks/useTwitch';
import { api } from '@/lib/api-client';
import { mountWithSnapshots, createHookProbe1 } from '../testing/reactTesting';

// Use shared probe component for a hook with one argument
const HookProbe = createHookProbe1((arg: string) => useTwitchConfigs(arg));

describe('useTwitchConfigs', () => {
    it('loads and filters configs by guildId', async () => {
        const guildId = '123';
        const apiSpy = vi.spyOn(api, 'getTwitchConfigs').mockResolvedValueOnce([
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
        apiSpy.mockRestore();
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
        createSpy.mockRestore();
    });
});
