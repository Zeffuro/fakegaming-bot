import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { setupModelMocks } from '@zeffuro/fakegaming-common/testing';
import { LeaguePatchNotesFetcher } from '../leaguePatchNotesFetcher.js';
import axios from 'axios';

vi.mock('axios');

beforeAll(() => {
    setupModelMocks();
});

describe('LeaguePatchNotesFetcher', () => {
    let fetcher: LeaguePatchNotesFetcher;

    beforeEach(() => {
        fetcher = new LeaguePatchNotesFetcher();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct game name', () => {
            expect(fetcher.game).toBe('League of Legends');
        });
    });

    describe('getPatchNotesUrl', () => {
        it('should return the correct patch notes URL', () => {
            const url = fetcher.getPatchNotesUrl();
            expect(url).toBe('https://www.leagueoflegends.com/en-us/news/tags/patch-notes/');
        });
    });

    describe('parsePatchNotes', () => {
        it('should parse valid patch notes HTML', () => {
            const mockHtml = `
                <html>
                    <script id="__NEXT_DATA__" type="application/json">
                        {
                            "props": {
                                "pageProps": {
                                    "page": {
                                        "blades": [
                                            {
                                                "type": "articleCardGrid",
                                                "items": [
                                                    {
                                                        "title": "Patch 14.5 Notes",
                                                        "description": {
                                                            "body": "Welcome to Patch 14.5!"
                                                        },
                                                        "action": {
                                                            "payload": {
                                                                "url": "/en-us/news/game-updates/patch-14-5-notes/"
                                                            }
                                                        },
                                                        "publishedAt": "2024-03-06T00:00:00Z",
                                                        "media": {
                                                            "url": "https://example.com/image.jpg"
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    </script>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.game).toBe('League of Legends');
            expect(result?.title).toBe('Patch 14.5 Notes');
            expect(result?.content).toBe('Welcome to Patch 14.5!');
            expect(result?.version).toBe('14.5');
            expect(result?.url).toBe('https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-5-notes/');
        });

        it('should return null for invalid HTML', () => {
            const result = fetcher.parsePatchNotes('<html><body>Invalid</body></html>');
            expect(result).toBeNull();
        });

        it('should return null when no NEXT_DATA script found', () => {
            const mockHtml = '<html><body>No data</body></html>';
            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should return null when articleCardGrid is missing', () => {
            const mockHtml = `
                <html>
                    <script id="__NEXT_DATA__" type="application/json">
                        {
                            "props": {
                                "pageProps": {
                                    "page": {
                                        "blades": []
                                    }
                                }
                            }
                        }
                    </script>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should handle absolute URLs', () => {
            const mockHtml = `
                <html>
                    <script id="__NEXT_DATA__" type="application/json">
                        {
                            "props": {
                                "pageProps": {
                                    "page": {
                                        "blades": [
                                            {
                                                "type": "articleCardGrid",
                                                "items": [
                                                    {
                                                        "title": "Patch 14.5 Notes",
                                                        "description": {
                                                            "body": "Content"
                                                        },
                                                        "action": {
                                                            "payload": {
                                                                "url": "https://www.leagueoflegends.com/en-us/news/patch-14-5/"
                                                            }
                                                        },
                                                        "publishedAt": "2024-03-06T00:00:00Z",
                                                        "media": {
                                                            "url": "https://example.com/image.jpg"
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    </script>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.url).toBe('https://www.leagueoflegends.com/en-us/news/patch-14-5/');
        });
    });

    describe('fetchFullPatchContent', () => {
        it('should fetch and parse full patch content', async () => {
            const mockHtml = `
                <html>
                    <script id="__NEXT_DATA__" type="application/json">
                        {
                            "props": {
                                "pageProps": {
                                    "page": {
                                        "blades": [
                                            {
                                                "type": "patchNotesRichText",
                                                "richText": {
                                                    "body": "<div id='patch-notes-container'><blockquote>Patch highlights here</blockquote></div><div><div id='patch-patch-highlights'></div></div><div class='content-border'><img src='https://example.com/highlight.jpg'/></div>"
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    </script>
                </html>
            `;

            vi.mocked(axios.get).mockResolvedValue({ data: mockHtml });

            const result = await fetcher.fetchFullPatchContent('https://example.com/patch');

            expect(result).not.toBeNull();
            expect(result?.content).toBe('Patch highlights here');
            expect(result?.fullImage).toBe('https://example.com/highlight.jpg');
        });

        it('should return null when NEXT_DATA is missing', async () => {
            vi.mocked(axios.get).mockResolvedValue({ data: '<html><body>No data</body></html>' });

            const result = await fetcher.fetchFullPatchContent('https://example.com/patch');

            expect(result).toBeNull();
        });

        it('should return null when richText is missing', async () => {
            const mockHtml = `
                <html>
                    <script id="__NEXT_DATA__" type="application/json">
                        {
                            "props": {
                                "pageProps": {
                                    "page": {
                                        "blades": []
                                    }
                                }
                            }
                        }
                    </script>
                </html>
            `;

            vi.mocked(axios.get).mockResolvedValue({ data: mockHtml });

            const result = await fetcher.fetchFullPatchContent('https://example.com/patch');

            expect(result).toBeNull();
        });
    });
});
