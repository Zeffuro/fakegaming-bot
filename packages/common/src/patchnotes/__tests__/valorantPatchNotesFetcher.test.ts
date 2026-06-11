import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValorantPatchNotesFetcher } from '../valorantPatchNotesFetcher.js';

function buildNextData(payload: unknown) {
    return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
}

function buildListPayload() {
    return {
        props: {
            pageProps: {
                page: {
                    blades: [
                        {
                            type: 'articleCardGrid',
                            items: [
                                {
                                    title: 'VALORANT Patch Notes 12.11',
                                    description: { body: 'A light little patch to end Act 3.' },
                                    action: { payload: { url: '/en-us/news/game-updates/valorant-patch-notes-12-11' } },
                                    publishedAt: '2026-06-09T13:00:00.000Z',
                                    media: { url: 'https://img/valorant.jpg' },
                                },
                            ],
                        },
                    ],
                },
            },
        },
    };
}

describe('ValorantPatchNotesFetcher', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('parses latest patch from official Riot article grid', () => {
        const fetcher = new ValorantPatchNotesFetcher();
        const note = fetcher.parsePatchNotes(buildNextData(buildListPayload()));

        expect(note).not.toBeNull();
        expect(note?.game).toBe('VALORANT');
        expect(note?.title).toBe('VALORANT Patch Notes 12.11');
        expect(note?.url).toBe('https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-11');
        expect(note?.version).toBe('12.11');
        expect(note?.imageUrl).toBe('https://img/valorant.jpg');
    });

    it('returns null for malformed list data', () => {
        const fetcher = new ValorantPatchNotesFetcher();

        expect(fetcher.parsePatchNotes('<script id="__NEXT_DATA__">{bad json</script>')).toBeNull();
        expect(fetcher.parsePatchNotes(buildNextData({ props: { pageProps: { page: { blades: [] } } } }))).toBeNull();
    });

    it('keeps absolute article urls', () => {
        const payload = buildListPayload();
        const item = (payload.props.pageProps.page.blades[0].items[0]);
        item.action.payload.url = 'https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-11';
        const fetcher = new ValorantPatchNotesFetcher();

        const note = fetcher.parsePatchNotes(buildNextData(payload));

        expect(note?.url).toBe('https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-11');
    });

    it('fetches full rich text content', async () => {
        const fetcher = new ValorantPatchNotesFetcher();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            text: vi.fn().mockResolvedValue(buildNextData({
                props: {
                    pageProps: {
                        page: {
                            blades: [
                                {
                                    type: 'articleRichText',
                                    richText: {
                                        body: '<p>Hi, friends!</p><h2>ALL PLATFORMS</h2><ul><li>Bug fixes</li></ul>'
                                    }
                                }
                            ]
                        }
                    }
                }
            }))
        }));

        const full = await fetcher.fetchFullPatchContent('https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-11');

        expect(full?.content).toContain('Hi, friends!');
        expect(full?.content).toContain('**ALL PLATFORMS**');
        expect(full?.content).toContain('- Bug fixes');
    });

    it('returns null when full article rich text is missing', async () => {
        const fetcher = new ValorantPatchNotesFetcher();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            text: vi.fn().mockResolvedValue(buildNextData({
                props: {
                    pageProps: {
                        page: {
                            blades: [{ type: 'articleRichText' }]
                        }
                    }
                }
            }))
        }));

        await expect(fetcher.fetchFullPatchContent('https://playvalorant.com/article')).resolves.toBeNull();
    });
});
