import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildSteamNewsEmbedPayload,
    fetchSteamNewsForApp,
    selectNextSteamNewsItem,
    type SteamNewsItem,
} from '../steamNews.js';

const baseItem: SteamNewsItem = {
    gid: '1',
    title: 'Update',
    url: 'https://store.steampowered.com/news/app/730/view/1',
    date: 1782074400,
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('steam news jobs', () => {
    it('selects the newest unseen item after the last announced gid', () => {
        const items: SteamNewsItem[] = [
            { ...baseItem, gid: '1', title: 'First', date: 1 },
            { ...baseItem, gid: '2', title: 'Second', date: 2 },
            { ...baseItem, gid: '3', title: 'Third', date: 3 },
        ];

        expect(selectNextSteamNewsItem(items, null)?.gid).toBe('3');
        expect(selectNextSteamNewsItem(items, '1')?.gid).toBe('3');
        expect(selectNextSteamNewsItem(items, '3')).toBeNull();
        expect(selectNextSteamNewsItem(items, 'missing')?.gid).toBe('3');
    });

    it('fetches Steam community announcements sorted by date', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                appnews: {
                    appid: 730,
                    newsitems: [
                        { ...baseItem, gid: 'newer', title: 'Newer', date: 20 },
                        { ...baseItem, gid: 'older', title: 'Older', date: 10 },
                        { gid: 123, title: 'Invalid', url: 'https://example.test', date: 30 },
                    ],
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const items = await fetchSteamNewsForApp(730, 2);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
        expect(calledUrl).toContain('appid=730');
        expect(calledUrl).toContain('count=2');
        expect(calledUrl).toContain('feeds=steam_community_announcements');
        expect(items.map((item) => item.gid)).toEqual(['older', 'newer']);
    });

    it('throws when the Steam API request fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

        await expect(fetchSteamNewsForApp(730)).rejects.toThrow('Steam news request failed with status 503');
    });

    it('builds a Discord embed payload with sanitized announcement contents', () => {
        const payload = buildSteamNewsEmbedPayload({
            id: 1,
            steamAppId: 730,
            appName: 'Counter-Strike 2',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
            customMessage: 'New game news',
        }, {
            ...baseItem,
            title: 'Patch released',
            contents: '<p>[b]Important[/b] &amp; ready</p>',
            feedlabel: 'Steam Community',
        });

        expect(payload).toMatchObject({
            content: 'New game news',
            embeds: [
                {
                    title: 'Patch released',
                    url: baseItem.url,
                    description: 'Important & ready',
                    author: {
                        name: 'Counter-Strike 2',
                    },
                    footer: {
                        text: 'Steam Community',
                    },
                },
            ],
        });
    });
});
