import { describe, it, expect } from 'vitest';
import { LeaguePatchNotesFetcher } from '../leaguePatchNotesFetcher.js';

function buildNextData(payload: unknown) {
    return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
}

describe('LeaguePatchNotesFetcher.parsePatchNotes', () => {
    it('parses latest patch from NEXT_DATA article grid', () => {
        const payload = {
            props: {
                pageProps: {
                    page: {
                        blades: [
                            { type: 'somethingElse' },
                            {
                                type: 'articleCardGrid',
                                items: [
                                    {
                                        title: 'Patch 14.2 Notes',
                                        description: { body: 'Balance changes and more' },
                                        action: { payload: { url: '/en-us/news/game-updates/patch-14-2-notes/' } },
                                        publishedAt: '2025-01-15T08:00:00Z',
                                        media: { url: 'https://img/cover.png' },
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        };
        const html = `${buildNextData(payload)}`;
        const fetcher = new LeaguePatchNotesFetcher();
        const note = fetcher.parsePatchNotes(html);
        expect(note).not.toBeNull();
        expect(note?.game).toBe('League of Legends');
        expect(note?.title).toBe('Patch 14.2 Notes');
        expect(note?.url).toBe('https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-2-notes/');
        expect(note?.version).toBe('14.2');
        expect(note?.imageUrl).toBe('https://img/cover.png');
        expect(typeof note?.publishedAt).toBe('number');
    });
});

