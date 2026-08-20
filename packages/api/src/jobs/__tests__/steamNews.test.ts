import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildSteamNewsEmbedPayload,
    extractSteamNewsImageUrl,
    fetchSteamNewsImageUrl,
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

    it('does not select stale Steam items older than the last announced timestamp', () => {
        const gamescom = { ...baseItem, gid: '1838407329256944', title: 'Gamescom 2026', date: 1784214059 };
        const coaches = { ...baseItem, gid: '1838407329259789', title: 'Coaches: New Vehicle Features', date: 1784300458 };

        expect(selectNextSteamNewsItem([gamescom], coaches.gid, coaches.date * 1000)).toBeNull();
        expect(selectNextSteamNewsItem([gamescom, coaches], gamescom.gid, gamescom.date * 1000)?.gid).toBe(coaches.gid);
    });

    it('uses last announced timestamps even when the stored gid is missing from the feed', () => {
        const items: SteamNewsItem[] = [
            { ...baseItem, gid: 'older', title: 'Older', date: 10 },
            { ...baseItem, gid: 'newer', title: 'Newer', date: 20 },
        ];

        expect(selectNextSteamNewsItem(items, 'missing', 20_000)).toBeNull();
        expect(selectNextSteamNewsItem(items, 'missing', '1970-01-01T00:00:15.000Z')?.gid).toBe('newer');
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

    it('adds an embed image when Steam news image metadata is available', () => {
        const payload = buildSteamNewsEmbedPayload({
            id: 1,
            steamAppId: 227300,
            appName: 'Euro Truck Simulator 2',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        }, baseItem, 'https://clan.fastly.steamstatic.com/images/4419325/post.jpg');

        expect(payload).toMatchObject({
            embeds: [
                {
                    image: {
                        url: 'https://clan.fastly.steamstatic.com/images/4419325/post.jpg',
                    },
                },
            ],
        });
    });

    it('localizes application fallbacks while preserving Steam-provided fields', () => {
        const subscription = {
            id: 1,
            steamAppId: 730,
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        };
        const english = buildSteamNewsEmbedPayload(subscription, baseItem, null, 'en');
        const dutch = buildSteamNewsEmbedPayload(subscription, baseItem, null, 'nl');

        expect(english).toMatchObject({
            embeds: [{
                title: 'Update',
                author: { name: 'Steam app 730' },
                description: 'New Steam announcement published.',
                footer: { text: 'Steam News' },
            }],
        });
        expect(dutch).toMatchObject({
            embeds: [{
                title: 'Update',
                author: { name: 'Steam-app 730' },
                description: 'Er is een nieuwe Steam-aankondiging gepubliceerd.',
                footer: { text: 'Steam-nieuws' },
            }],
        });
    });

    it('extracts Steam news images from OpenGraph metadata and body markup', () => {
        expect(extractSteamNewsImageUrl('<meta property="og:image" content="https://cdn.example.test/post.jpg">')).toBe('https://cdn.example.test/post.jpg');
        expect(extractSteamNewsImageUrl('[img]https://cdn.example.test/body.png[/img]')).toBe('https://cdn.example.test/body.png');
    });

    it('fetches article metadata when the news item body has no image', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<html><head><meta property="og:image" content="https://cdn.example.test/article.jpg"></head></html>',
        });

        await expect(fetchSteamNewsImageUrl(baseItem, fetchMock as unknown as typeof fetch)).resolves.toBe('https://cdn.example.test/article.jpg');
        expect(fetchMock).toHaveBeenCalledWith(baseItem.url);
    });
});
