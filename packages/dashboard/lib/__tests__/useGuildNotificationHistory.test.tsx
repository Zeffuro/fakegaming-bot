import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { useGuildNotificationHistory } from '@/components/hooks/useGuildNotificationHistory';
import { api } from '@/lib/api-client';
import { createHookProbe1, mountWithSnapshots } from '../testing/reactTesting';

interface ProbeArg {
    guildId: string;
    options: Parameters<typeof useGuildNotificationHistory>[1];
}

const HookProbe = createHookProbe1((arg: ProbeArg) => useGuildNotificationHistory(arg.guildId, arg.options));

describe('useGuildNotificationHistory', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('passes provider, days, and limit filters to the API', async () => {
        const response = {
            records: [],
            total: 0,
            limit: 12,
            offset: 0,
            summary: {
                total: 0,
                byProvider: [],
                trend: [],
            },
        };
        const loadSpy = vi.spyOn(api, 'getGuildNotifications').mockResolvedValue(response);

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, {
                arg: {
                    guildId: 'guild-1',
                    options: {
                        limit: 12,
                        days: 30,
                        provider: 'twitch',
                    },
                },
                onSnapshot,
            })
        );

        expect(loadSpy).toHaveBeenCalledWith('guild-1', {
            limit: 12,
            days: 30,
            provider: 'twitch',
        });
        expect(last()?.history).toEqual(response);
        expect(last()?.loading).toBe(false);
        expect(last()?.error).toBeNull();

        unmount();
    });
});
