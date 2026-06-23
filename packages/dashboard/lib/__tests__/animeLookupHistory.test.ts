import { describe, expect, it } from 'vitest';
import {
    addAnimeLookupHistoryEntry,
    createAnimeLookupHistoryEntry,
    filterAnimeLookupHistory,
    parseAnimeLookupHistory,
    type AnimeLookupHistoryEntry,
} from '@/lib/animeLookupHistory';
import type { AnimeSearchResult } from '@/lib/api-client';

function result(overrides: Partial<AnimeSearchResult>): AnimeSearchResult {
    return {
        id: 1,
        title: { english: 'Airing Show', romaji: 'Airing Romaji', native: 'Airing Native' },
        type: 'ANIME',
        status: 'RELEASING',
        format: 'TV',
        coverImage: { large: 'https://example.test/cover.jpg' },
        ...overrides,
    } as AnimeSearchResult;
}

function entry(overrides: Partial<AnimeLookupHistoryEntry>): AnimeLookupHistoryEntry {
    return {
        id: 1,
        title: 'Airing Show',
        mediaType: 'anime',
        status: 'RELEASING',
        format: 'TV',
        coverImageUrl: null,
        recordedAt: 1000,
        subscribable: true,
        ...overrides,
    };
}

describe('animeLookupHistory', () => {
    it('creates lookup history entries from AniList results', () => {
        expect(createAnimeLookupHistoryEntry(result({}), 'anime', 1234)).toEqual({
            id: 1,
            title: 'Airing Show',
            mediaType: 'anime',
            status: 'RELEASING',
            format: 'TV',
            coverImageUrl: 'https://example.test/cover.jpg',
            recordedAt: 1234,
            subscribable: true,
        });

        expect(createAnimeLookupHistoryEntry(result({
            id: 2,
            type: 'MANGA',
            status: 'FINISHED',
            title: { english: null, romaji: 'Manga Title', native: null },
        }), 'anime', 1234)).toMatchObject({
            id: 2,
            title: 'Manga Title',
            mediaType: 'manga',
            subscribable: false,
        });
    });

    it('deduplicates by media type and AniList ID while keeping newest entries first', () => {
        const history = addAnimeLookupHistoryEntry([
            entry({ id: 1, title: 'Old', recordedAt: 1000 }),
            entry({ id: 2, title: 'Second', recordedAt: 2000 }),
        ], entry({ id: 1, title: 'New', recordedAt: 3000 }), 2);

        expect(history.map((item) => `${item.id}:${item.title}`)).toEqual(['1:New', '2:Second']);
    });

    it('filters history by media type and normalized query', () => {
        const history = [
            entry({ id: 1, title: 'Airing   Show', mediaType: 'anime', status: 'RELEASING' }),
            entry({ id: 2, title: 'Manga Title', mediaType: 'manga', status: 'FINISHED', subscribable: false }),
        ];

        expect(filterAnimeLookupHistory(history, 'anime').map((item) => item.id)).toEqual([1]);
        expect(filterAnimeLookupHistory(history, 'all', 'manga title').map((item) => item.id)).toEqual([2]);
        expect(filterAnimeLookupHistory(history, 'all', 'lookup only').map((item) => item.id)).toEqual([2]);
    });

    it('parses valid history entries and drops invalid local storage records', () => {
        const parsed = parseAnimeLookupHistory(JSON.stringify([
            entry({ id: 1, title: 'Valid' }),
            { id: 'bad', title: 'Invalid', mediaType: 'anime', recordedAt: 1 },
            { id: 2, title: '', mediaType: 'manga', recordedAt: 1 },
        ]));

        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.title).toBe('Valid');
        expect(parseAnimeLookupHistory('not json')).toEqual([]);
    });
});
